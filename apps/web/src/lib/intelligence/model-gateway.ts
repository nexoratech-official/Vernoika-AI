export type ModelContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "auto" } };

export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string | ModelContentPart[];
};

export interface ModelGateway {
  stream(messages: ModelMessage[], signal: AbortSignal): Promise<Response>;
  modelName(): string;
}

type GatewayConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

function getGatewayConfig(): GatewayConfig | null {
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const apiKey = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();

  if (!baseUrl && !apiKey && !model) return null;
  if (!baseUrl || !apiKey || !model) {
    throw new Error("Set AI_BASE_URL, AI_API_KEY, and AI_MODEL to enable the model gateway.");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(baseUrl);
  } catch {
    throw new Error("AI_BASE_URL must be a valid absolute URL.");
  }

  const isLoopback =
    endpoint.hostname === "localhost" ||
    endpoint.hostname === "127.0.0.1" ||
    endpoint.hostname === "[::1]";
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && isLoopback)) {
    throw new Error("AI_BASE_URL must use HTTPS except for a local development endpoint.");
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("AI_BASE_URL must not contain credentials, query parameters, or a fragment.");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    model,
  };
}

class OpenAICompatibleGateway implements ModelGateway {
  constructor(private readonly config: GatewayConfig) {}

  modelName() {
    return this.config.model;
  }

  async stream(messages: ModelMessage[], signal: AbortSignal) {
    return fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      cache: "no-store",
      signal,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
        max_tokens: 1200,
        stream_options: { include_usage: true },
      }),
    });
  }
}

export function getModelGateway(): ModelGateway | null {
  const config = getGatewayConfig();
  return config ? new OpenAICompatibleGateway(config) : null;
}

export function isModelGatewayConfigured() {
  return Boolean(
    process.env.AI_BASE_URL?.trim() &&
      process.env.AI_API_KEY?.trim() &&
      process.env.AI_MODEL?.trim(),
  );
}
