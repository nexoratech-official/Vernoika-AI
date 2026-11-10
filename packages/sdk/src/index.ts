export type VornokiaMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatCompletionParams = {
  model?: "vornokia-prime";
  messages: VornokiaMessage[];
};

export type ChatCompletion = {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type ChatCompletionChunk = {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: "assistant"; content?: string };
    finish_reason: string | null;
  }>;
  usage?: ChatCompletion["usage"];
};

export type VornokiaOptions = {
  apiKey: string;
  baseURL: string;
  fetch?: typeof fetch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function apiErrorMessage(value: unknown, fallback: string) {
  if (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.message === "string"
  ) {
    return value.error.message;
  }
  return fallback;
}

function isCompletion(value: unknown): value is ChatCompletion {
  if (!isRecord(value) || !Array.isArray(value.choices) || !isRecord(value.usage)) return false;
  return (
    typeof value.id === "string" &&
    value.object === "chat.completion" &&
    typeof value.created === "number" &&
    typeof value.model === "string" &&
    value.choices.every((choice) =>
      isRecord(choice) &&
      typeof choice.index === "number" &&
      isRecord(choice.message) &&
      choice.message.role === "assistant" &&
      typeof choice.message.content === "string" &&
      typeof choice.finish_reason === "string"
    ) &&
    typeof value.usage.prompt_tokens === "number" &&
    typeof value.usage.completion_tokens === "number" &&
    typeof value.usage.total_tokens === "number"
  );
}

function isChunk(value: unknown): value is ChatCompletionChunk {
  if (!isRecord(value) || !Array.isArray(value.choices)) return false;
  return (
    typeof value.id === "string" &&
    value.object === "chat.completion.chunk" &&
    typeof value.created === "number" &&
    typeof value.model === "string" &&
    value.choices.every((choice) =>
      isRecord(choice) &&
      typeof choice.index === "number" &&
      isRecord(choice.delta) &&
      (choice.delta.role === undefined || choice.delta.role === "assistant") &&
      (choice.delta.content === undefined || typeof choice.delta.content === "string") &&
      (choice.finish_reason === null || typeof choice.finish_reason === "string")
    )
  );
}

async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
    buffer += decoder.decode();
    if (buffer.startsWith("data:")) yield buffer.slice(5).trim();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

class ChatCompletionsClient {
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(options: VornokiaOptions) {
    if (!/^vno_live_[A-Za-z0-9_-]{43}$/.test(options.apiKey)) {
      throw new Error("apiKey must be a Vornokia live API key.");
    }
    let endpoint: URL;
    try {
      endpoint = new URL(options.baseURL);
    } catch {
      throw new Error("baseURL must be a valid absolute URL.");
    }
    const localDevelopment =
      endpoint.hostname === "localhost" ||
      endpoint.hostname === "127.0.0.1" ||
      endpoint.hostname === "[::1]";
    if (
      (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && localDevelopment)) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.pathname !== "/" ||
      endpoint.search ||
      endpoint.hash
    ) {
      throw new Error("baseURL must be a secure origin without credentials, path, query, or fragment.");
    }
    this.baseURL = endpoint.origin;
    this.apiKey = options.apiKey;
    this.fetcher = options.fetch ?? fetch;
  }

  create(params: ChatCompletionParams & { stream: true }): AsyncIterable<ChatCompletionChunk>;
  create(params: ChatCompletionParams & { stream?: false }): Promise<ChatCompletion>;
  create(
    params: ChatCompletionParams & { stream?: boolean },
  ): Promise<ChatCompletion> | AsyncGenerator<ChatCompletionChunk> {
    return params.stream ? this.stream(params) : this.complete(params);
  }

  private async request(params: ChatCompletionParams, stream: boolean) {
    return this.fetcher(`${this.baseURL}/api/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...params, stream }),
    });
  }

  private async complete(params: ChatCompletionParams): Promise<ChatCompletion> {
    const response = await this.request(params, false);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("The Vornokia API returned an invalid response.");
    }
    if (!response.ok) throw new Error(apiErrorMessage(payload, "The Vornokia API request failed."));
    if (!isCompletion(payload)) throw new Error("The Vornokia API returned an unexpected completion.");
    return payload;
  }

  private async *stream(params: ChatCompletionParams): AsyncGenerator<ChatCompletionChunk> {
    const response = await this.request(params, true);
    if (!response.ok) {
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The Vornokia API request failed.");
      }
      throw new Error(apiErrorMessage(payload, "The Vornokia API request failed."));
    }
    if (!response.body) throw new Error("The Vornokia API response stream is unavailable.");

    for await (const data of readSseData(response.body)) {
      if (data === "[DONE]") return;
      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        throw new Error("The Vornokia API response stream contained invalid data.");
      }
      if (isRecord(payload) && isRecord(payload.error)) {
        throw new Error(apiErrorMessage(payload, "The Vornokia API response stream failed."));
      }
      if (!isChunk(payload)) throw new Error("The Vornokia API returned an unexpected stream chunk.");
      yield payload;
    }
  }
}

export class Vornokia {
  readonly chat: { completions: ChatCompletionsClient };

  constructor(options: VornokiaOptions) {
    const completions = new ChatCompletionsClient(options);
    this.chat = { completions };
  }
}
