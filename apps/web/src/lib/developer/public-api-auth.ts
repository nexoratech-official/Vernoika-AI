import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

type AuthorizationRow = {
  authorized: boolean;
  error_code: string | null;
  api_key_id: string | null;
  owner_id: string | null;
  app_id: string | null;
  scopes: string[] | null;
  remaining_monthly: number | null;
};

export type DeveloperApiAccess = {
  supabase: SupabaseClient;
  keyHash: string;
  apiKeyId: string;
  ownerId: string;
  appId: string;
  remainingMonthly: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseAuthorizationRow(value: unknown): AuthorizationRow | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.authorized !== "boolean" ||
    (value.error_code !== null && typeof value.error_code !== "string") ||
    (value.api_key_id !== null && typeof value.api_key_id !== "string") ||
    (value.owner_id !== null && typeof value.owner_id !== "string") ||
    (value.app_id !== null && typeof value.app_id !== "string") ||
    (value.scopes !== null && (!Array.isArray(value.scopes) || !value.scopes.every((scope) => typeof scope === "string"))) ||
    (value.remaining_monthly !== null && typeof value.remaining_monthly !== "number")
  ) {
    return null;
  }
  return value as AuthorizationRow;
}

export function publicApiError(
  message: string,
  status: number,
  code: string,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { error: { message, type: status === 401 ? "authentication_error" : "invalid_request_error", code } },
    {
      status,
      headers: { "Cache-Control": "no-store", ...headers },
    },
  );
}

export async function authorizeDeveloperApiKey(
  request: Request,
): Promise<{ access: DeveloperApiAccess } | { response: NextResponse }> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(vno_live_[A-Za-z0-9_-]{43})$/i.exec(authorization);
  if (!match) {
    return {
      response: publicApiError("A valid Vornokia API key is required.", 401, "invalid_api_key", {
        "WWW-Authenticate": "Bearer",
      }),
    };
  }

  const key = match[1];
  const keyHash = createHash("sha256").update(key).digest("hex");
  let supabase: SupabaseClient;
  try {
    const config = getSupabaseConfig();
    if (!config) {
      return { response: publicApiError("The developer API is not configured.", 503, "service_unavailable") };
    }
    supabase = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  } catch {
    return { response: publicApiError("The developer API is temporarily unavailable.", 503, "service_unavailable") };
  }

  let rpcResult;
  try {
    rpcResult = await supabase.rpc("consume_developer_api_key", {
      p_key_hash: keyHash,
    });
  } catch {
    console.error("vornokia_developer_api_key_check_unavailable");
    return { response: publicApiError("API key verification is temporarily unavailable.", 503, "service_unavailable") };
  }
  const { data, error } = rpcResult;
  if (error) {
    console.error("vornokia_developer_api_key_check_failed", { code: error.code });
    return { response: publicApiError("API key verification is temporarily unavailable.", 503, "service_unavailable") };
  }

  const row = parseAuthorizationRow(Array.isArray(data) ? data[0] : data);
  if (!row) {
    console.error("vornokia_developer_api_key_check_invalid_result");
    return { response: publicApiError("API key verification is temporarily unavailable.", 503, "service_unavailable") };
  }
  if (!row.authorized) {
    if (row.error_code === "rate_limited") {
      return {
        response: publicApiError("This API key has reached its per-minute request limit.", 429, "rate_limit_exceeded", {
          "Retry-After": "60",
        }),
      };
    }
    if (row.error_code === "monthly_quota_exceeded") {
      return {
        response: publicApiError("This API key has reached its monthly request quota.", 429, "monthly_quota_exceeded"),
      };
    }
    if (row.error_code === "insufficient_scope") {
      return { response: publicApiError("This API key does not have permission for this operation.", 403, "insufficient_scope") };
    }
    return {
      response: publicApiError("The API key is invalid or has been revoked.", 401, "invalid_api_key", {
        "WWW-Authenticate": "Bearer",
      }),
    };
  }
  if (!row.api_key_id || !row.owner_id || !row.app_id || typeof row.remaining_monthly !== "number") {
    console.error("vornokia_developer_api_key_check_missing_identity");
    return { response: publicApiError("API key verification is temporarily unavailable.", 503, "service_unavailable") };
  }

  return {
    access: {
      supabase,
      keyHash,
      apiKeyId: row.api_key_id,
      ownerId: row.owner_id,
      appId: row.app_id,
      remainingMonthly: row.remaining_monthly,
    },
  };
}
