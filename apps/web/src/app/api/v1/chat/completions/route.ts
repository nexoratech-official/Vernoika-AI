import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/http/read-json-body";
import { getModelGateway } from "@/lib/intelligence/model-gateway";
import { PRIME_SYSTEM_MESSAGE } from "@/lib/intelligence/prime";
import {
  authorizeDeveloperApiKey,
  publicApiError,
  type DeveloperApiAccess,
} from "@/lib/developer/public-api-auth";
import type { ModelMessage } from "@/lib/intelligence/model-gateway";

const publicModel = "vornokia-prime";
const maxRequestBytes = 64_000;
const maxMessageLength = 4_000;
const maxTotalMessageLength = 20_000;
const maxResponseLength = 32_000;

type PublicMessage = { role: "user" | "assistant"; content: string };
type ProviderUsage = { content: string; inputTokens: number | null; outputTokens: number | null; finishReason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMessages(value: unknown): PublicMessage[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const messages: PublicMessage[] = [];
  let totalLength = 0;
  for (const item of value) {
    if (
      !isRecord(item) ||
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.content !== "string" ||
      !item.content.trim() ||
      item.content.length > maxMessageLength
    ) {
      return null;
    }
    totalLength += item.content.length;
    if (totalLength > maxTotalMessageLength) return null;
    messages.push({ role: item.role, content: item.content });
  }
  return messages.some((message) => message.role === "user") ? messages : null;
}

function parseProviderLine(line: string, usage: ProviderUsage) {
  if (!line.startsWith("data:")) return;
  const data = line.slice(5).trim();
  if (!data || data === "[DONE]") return;

  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw new Error("The model provider returned an invalid response stream.");
  }
  if (!isRecord(value)) return;
  if (isRecord(value.usage)) {
    if (typeof value.usage.prompt_tokens === "number") usage.inputTokens = value.usage.prompt_tokens;
    if (typeof value.usage.completion_tokens === "number") usage.outputTokens = value.usage.completion_tokens;
  }
  const choices = value.choices;
  const first = Array.isArray(choices) ? choices[0] : null;
  if (!isRecord(first)) return;
  if (typeof first.finish_reason === "string") usage.finishReason = first.finish_reason;
  const delta = first.delta;
  const content = isRecord(delta) ? delta.content : null;
  if (typeof content === "string") {
    if (usage.content.length + content.length > maxResponseLength) {
      throw new Error("The model response exceeded the supported size.");
    }
    usage.content += content;
  }
}

async function recordUsage(
  access: DeveloperApiAccess,
  requestId: string,
  model: string,
  status: "success" | "error",
  inputTokens: number | null,
  outputTokens: number | null,
) {
  const { data, error } = await access.supabase.rpc("record_developer_api_usage", {
    p_key_hash: access.keyHash,
    p_request_id: requestId,
    p_model: model,
    p_status: status,
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
  });
  if (error || data !== true) {
    console.error("vornokia_developer_api_usage_write_failed", {
      code: error?.code ?? (data === true ? undefined : "missing_result"),
      apiKeyId: access.apiKeyId,
      requestId,
    });
    return false;
  }
  return true;
}

function publicCompletion(
  id: string,
  created: number,
  usage: ProviderUsage,
) {
  return {
    id,
    object: "chat.completion",
    created,
    model: publicModel,
    choices: [{
      index: 0,
      message: { role: "assistant", content: usage.content },
      finish_reason: usage.finishReason,
    }],
    usage: {
      prompt_tokens: usage.inputTokens ?? 0,
      completion_tokens: usage.outputTokens ?? 0,
      total_tokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    },
  };
}

export async function POST(request: Request) {
  const authentication = await authorizeDeveloperApiKey(request);
  if ("response" in authentication) return authentication.response;
  const { access } = authentication;

  const parsed = await readJsonBody(request, maxRequestBytes);
  if (!parsed.ok) {
    return publicApiError(parsed.error, parsed.status, parsed.status === 413 ? "request_too_large" : "invalid_json");
  }
  if (!isRecord(parsed.value) || Object.keys(parsed.value).some((key) => !["model", "messages", "stream"].includes(key))) {
    return publicApiError("Only model, messages, and stream parameters are supported.", 400, "invalid_request");
  }
  if (parsed.value.model !== undefined && parsed.value.model !== publicModel) {
    return publicApiError(`The only supported model identifier is "${publicModel}".`, 400, "model_not_found");
  }
  if (parsed.value.stream !== undefined && typeof parsed.value.stream !== "boolean") {
    return publicApiError("The stream parameter must be a boolean.", 400, "invalid_request");
  }
  const messages = readMessages(parsed.value.messages);
  if (!messages) {
    return publicApiError(
      "Provide 1–20 user or assistant messages, each under 4,000 characters and 20,000 characters total.",
      400,
      "invalid_messages",
    );
  }

  let gateway;
  try {
    gateway = getModelGateway();
  } catch {
    return publicApiError("The model gateway configuration is incomplete or invalid.", 503, "service_unavailable");
  }
  if (!gateway) return publicApiError("The model gateway is not configured.", 503, "service_unavailable");

  const requestId = randomUUID();
  const completionId = `chatcmpl-${randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const abortController = new AbortController();
  let providerResponse: Response;
  try {
    const modelMessages: ModelMessage[] = [
      PRIME_SYSTEM_MESSAGE,
      ...messages.map((message) => ({ role: message.role, content: message.content })),
    ];
    providerResponse = await gateway.stream(
      modelMessages,
      AbortSignal.any([request.signal, abortController.signal, AbortSignal.timeout(90_000)]),
    );
  } catch {
    await recordUsage(access, requestId, publicModel, "error", null, null);
    return publicApiError("The model provider could not be reached. Please try again.", 502, "provider_unavailable", {
      "X-Request-ID": requestId,
    });
  }
  if (!providerResponse.ok || !providerResponse.body) {
    await recordUsage(access, requestId, publicModel, "error", null, null);
    console.error("vornokia_developer_api_provider_failed", {
      status: providerResponse.status,
      apiKeyId: access.apiKeyId,
      requestId,
    });
    return publicApiError("The model provider could not complete the request.", 502, "provider_error", {
      "X-Request-ID": requestId,
    });
  }

  const wantsStream = parsed.value.stream === true;
  if (!wantsStream) {
    const reader = providerResponse.body.getReader();
    const decoder = new TextDecoder();
    const usage: ProviderUsage = { content: "", inputTokens: null, outputTokens: null, finishReason: "stop" };
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        lines.forEach((line) => parseProviderLine(line, usage));
      }
      buffer += decoder.decode();
      if (buffer) parseProviderLine(buffer, usage);
    } catch {
      await recordUsage(access, requestId, publicModel, "error", usage.inputTokens, usage.outputTokens);
      return publicApiError("The model provider returned an invalid or incomplete response.", 502, "provider_error", {
        "X-Request-ID": requestId,
      });
    }

    if (!usage.content.trim()) {
      await recordUsage(access, requestId, publicModel, "error", usage.inputTokens, usage.outputTokens);
      return publicApiError("The model provider returned an empty response.", 502, "empty_model_response", {
        "X-Request-ID": requestId,
      });
    }
    if (!(await recordUsage(access, requestId, publicModel, "success", usage.inputTokens, usage.outputTokens))) {
      return publicApiError("The response was generated, but its usage could not be recorded.", 503, "usage_recording_failed", {
        "X-Request-ID": requestId,
      });
    }
    return NextResponse.json(publicCompletion(completionId, created, usage), {
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const usage: ProviderUsage = { content: "", inputTokens: null, outputTokens: null, finishReason: "stop" };
  const reader = providerResponse.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (value: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
      const chunk = (delta: Record<string, string>, finishReason: string | null = null) => ({
        id: completionId,
        object: "chat.completion.chunk",
        created,
        model: publicModel,
        choices: [{ index: 0, delta, finish_reason: finishReason }],
      });
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const before = usage.content.length;
            parseProviderLine(line, usage);
            if (usage.content.length > before) {
              emit(chunk({ content: usage.content.slice(before) }));
            }
          }
        }
        buffer += decoder.decode();
        if (buffer) {
          const before = usage.content.length;
          parseProviderLine(buffer, usage);
          if (usage.content.length > before) emit(chunk({ content: usage.content.slice(before) }));
        }
        if (!usage.content.trim()) throw new Error("The model provider returned an empty response.");
        if (!(await recordUsage(access, requestId, publicModel, "success", usage.inputTokens, usage.outputTokens))) {
          emit({ error: { message: "Usage could not be recorded for this response.", type: "server_error", code: "usage_recording_failed" } });
          controller.close();
          return;
        }
        emit(chunk({}, usage.finishReason));
        emit({
          id: completionId,
          object: "chat.completion.chunk",
          created,
          model: publicModel,
          choices: [],
          usage: {
            prompt_tokens: usage.inputTokens ?? 0,
            completion_tokens: usage.outputTokens ?? 0,
            total_tokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
          },
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        await recordUsage(access, requestId, publicModel, "error", usage.inputTokens, usage.outputTokens);
        console.error("vornokia_developer_api_stream_failed", { apiKeyId: access.apiKeyId, requestId });
        emit({ error: { message: "The model provider returned an invalid or incomplete response.", type: "server_error", code: "provider_error" } });
        controller.close();
      }
    },
    async cancel() {
      abortController.abort();
      await reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Request-ID": requestId,
    },
  });
}
