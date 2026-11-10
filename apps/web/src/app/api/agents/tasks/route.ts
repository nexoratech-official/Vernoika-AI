import { NextResponse } from "next/server";
import { getAgent } from "@/lib/agents/registry";
import { readJsonBody } from "@/lib/http/read-json-body";
import { getModelGateway } from "@/lib/intelligence/model-gateway";
import { getAuthenticatedContext, hasSameOrigin } from "@/lib/supabase/authenticated-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const maxTaskLength = 4000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSseLine(line: string, result: { content: string; inputTokens: number | null; outputTokens: number | null }) {
  if (!line.startsWith("data:")) return;
  const value = line.slice(5).trim();
  if (!value || value === "[DONE]") return;
  const chunk: unknown = JSON.parse(value);
  if (!isRecord(chunk)) return;
  if (isRecord(chunk.usage)) {
    if (typeof chunk.usage.prompt_tokens === "number") result.inputTokens = chunk.usage.prompt_tokens;
    if (typeof chunk.usage.completion_tokens === "number") result.outputTokens = chunk.usage.completion_tokens;
  }
  const choices = chunk.choices;
  const first = Array.isArray(choices) ? choices[0] : null;
  const delta = isRecord(first) ? first.delta : null;
  if (isRecord(delta) && typeof delta.content === "string") result.content += delta.content;
}

async function markTaskFailed(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  taskId: string,
  userId: string,
) {
  const { error } = await supabase
    .from("agent_tasks")
    .update({ status: "failed" })
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) console.error("vornokia_agent_task_status_write_failed", { code: error.code });
}

export async function GET() {
  const context = await getAuthenticatedContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const { data: tasks, error: taskError } = await context.supabase
    .from("agent_tasks")
    .select("id, agent_id, title, prompt, result, status, created_at, updated_at")
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (taskError) {
    return NextResponse.json({ error: "Agent tasks could not be loaded." }, { status: 500 });
  }

  const taskIds = (tasks ?? []).map((task) => task.id);
  let messages: Array<{ id: string; task_id: string; sender_role: string; sender_agent_id: string | null; content: string; created_at: string }> = [];
  if (taskIds.length) {
    const result = await context.supabase
      .from("agent_messages")
      .select("id, task_id, sender_role, sender_agent_id, content, created_at")
      .eq("user_id", context.user.id)
      .in("task_id", taskIds)
      .order("created_at", { ascending: true })
      .limit(200);
    if (result.error) {
      return NextResponse.json({ error: "Agent communication history could not be loaded." }, { status: 500 });
    }
    messages = result.data ?? [];
  }

  return NextResponse.json({
    tasks: (tasks ?? []).map((task) => ({
      ...task,
      agent: getAgent(task.agent_id)?.name ?? "Unknown specialist",
      messages: messages.filter((message) => message.task_id === task.id),
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const context = await getAuthenticatedContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const parsed = await readJsonBody(request, 24_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const payload = parsed.value;
  if (
    !isRecord(payload) ||
    typeof payload.agentId !== "string" ||
    typeof payload.prompt !== "string" ||
    !payload.prompt.trim() ||
    payload.prompt.trim().length > maxTaskLength
  ) {
    return NextResponse.json({ error: "Choose an agent and enter a task under 4,000 characters." }, { status: 400 });
  }
  const agent = getAgent(payload.agentId);
  if (!agent || agent.id === "prime") {
    return NextResponse.json({ error: "Select one of the available specialist agents." }, { status: 400 });
  }

  let gateway;
  try {
    gateway = getModelGateway();
  } catch {
    return NextResponse.json({ error: "The model gateway configuration is incomplete or invalid." }, { status: 503 });
  }
  if (!gateway) return NextResponse.json({ error: "The model gateway is not configured." }, { status: 503 });

  const { data: rateAllowed, error: rateError } = await context.supabase.rpc("consume_chat_request");
  if (rateError || typeof rateAllowed !== "boolean") {
    return NextResponse.json({ error: "Agent rate limiting is unavailable. Apply the latest database migration." }, { status: 503 });
  }
  if (!rateAllowed) {
    return NextResponse.json(
      { error: "You have reached the request limit. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const prompt = payload.prompt.trim();
  const title = prompt.split(/\s+/).slice(0, 9).join(" ").slice(0, 120);
  const { data: task, error: createError } = await context.supabase
    .from("agent_tasks")
    .insert({
      user_id: context.user.id,
      agent_id: agent.id,
      title: title || "Agent task",
      prompt,
      status: "running",
      approval_required: true,
    })
    .select("id, agent_id, title, prompt, status, created_at")
    .single();
  if (createError || !task) {
    return NextResponse.json({ error: "The agent task could not be created." }, { status: 500 });
  }

  const { error: handoffError } = await context.supabase.from("agent_messages").insert({
    task_id: task.id,
    user_id: context.user.id,
    sender_role: "prime",
    sender_agent_id: null,
    content: `Prime delegated this request to ${agent.name}: ${prompt}`,
  });
  if (handoffError) {
    await markTaskFailed(context.supabase, task.id, context.user.id);
    return NextResponse.json({ error: "The Prime-to-agent handoff could not be recorded." }, { status: 500 });
  }

  try {
    const response = await gateway.stream(
      [
        { role: "system", content: `${agent.instructions}\n\nYou are a specialist reporting back to Vornokia Prime. Do not execute tools, actions, or external operations. Produce an answer for user review.` },
        { role: "user", content: prompt },
      ],
      AbortSignal.timeout(90_000),
    );
    if (!response.ok || !response.body) {
      await markTaskFailed(context.supabase, task.id, context.user.id);
      return NextResponse.json({ error: "The selected agent could not complete this task." }, { status: 502 });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const output = { content: "", inputTokens: null as number | null, outputTokens: null as number | null };
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) parseSseLine(line, output);
    }
    buffer += decoder.decode();
    if (buffer) parseSseLine(buffer, output);
    const result = output.content.trim().slice(0, 20_000);
    if (!result) {
      await markTaskFailed(context.supabase, task.id, context.user.id);
      return NextResponse.json({ error: "The selected agent returned an empty response." }, { status: 502 });
    }

    const { error: responseMessageError } = await context.supabase.from("agent_messages").insert({
      task_id: task.id,
      user_id: context.user.id,
      sender_role: "specialist",
      sender_agent_id: agent.id,
      content: result,
    });
    if (responseMessageError) {
      await markTaskFailed(context.supabase, task.id, context.user.id);
      return NextResponse.json({ error: "The agent response could not be saved." }, { status: 500 });
    }
    const { error: updateError } = await context.supabase
      .from("agent_tasks")
      .update({ result, status: "awaiting_approval", updated_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("user_id", context.user.id);
    if (updateError) {
      return NextResponse.json({ error: "The response was generated but task status could not be saved." }, { status: 500 });
    }
    const { error: usageError } = await context.supabase.from("usage_events").insert({
      user_id: context.user.id,
      provider: "openai-compatible",
      model: gateway.modelName(),
      status: "success",
      input_tokens: output.inputTokens,
      output_tokens: output.outputTokens,
    });
    if (usageError) {
      console.error("vornokia_agent_usage_write_failed", { code: usageError.code });
      return NextResponse.json({ error: "The recommendation was saved, but model usage could not be recorded." }, { status: 500 });
    }

    const { error: primeMessageError } = await context.supabase.from("agent_messages").insert({
      task_id: task.id,
      user_id: context.user.id,
      sender_role: "prime",
      sender_agent_id: null,
      content: "Prime received the specialist recommendation. It is awaiting your review; no external action has been taken.",
    });
    if (primeMessageError) {
      console.error("vornokia_agent_prime_message_write_failed", { code: primeMessageError.code });
      return NextResponse.json({ error: "The recommendation was saved, but Prime's handoff could not be recorded." }, { status: 500 });
    }

    return NextResponse.json({
      task: { ...task, result, status: "awaiting_approval", agent: agent.name },
    }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    await markTaskFailed(context.supabase, task.id, context.user.id);
    return NextResponse.json({ error: "The agent could not be reached or its response stream failed." }, { status: 502 });
  }
}
