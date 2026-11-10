import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/http/read-json-body";
import { getAuthenticatedContext, hasSameOrigin } from "@/lib/supabase/authenticated-context";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET() {
  const context = await getAuthenticatedContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const { data, error } = await context.supabase
    .from("developer_api_keys")
    .select("id, app_id, name, key_prefix, scopes, per_minute_limit, created_at, last_used_at, revoked_at")
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("vornokia_developer_api_keys_read_failed", { code: error.code });
    return NextResponse.json({ error: "API keys could not be loaded." }, { status: 500 });
  }

  const { data: usage, error: usageError } = await context.supabase.rpc("get_my_developer_usage");
  if (usageError) {
    console.error("vornokia_developer_usage_read_failed", { code: usageError.code });
    return NextResponse.json({ error: "Developer usage could not be loaded." }, { status: 500 });
  }

  return NextResponse.json(
    { keys: data ?? [], usage: Array.isArray(usage) ? usage[0] ?? null : usage },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const context = await getAuthenticatedContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const parsed = await readJsonBody(request, 4_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  if (
    !isRecord(parsed.value) ||
    typeof parsed.value.appId !== "string" ||
    !uuidPattern.test(parsed.value.appId) ||
    typeof parsed.value.name !== "string"
  ) {
    return NextResponse.json({ error: "Choose an application and enter a key name." }, { status: 400 });
  }
  const name = parsed.value.name.trim();
  if (name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: "API key names must be between 1 and 80 characters." }, { status: 400 });
  }

  const secret = `vno_live_${randomBytes(32).toString("base64url")}`;
  const keyHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const hash = Buffer.from(keyHash).toString("hex");
  const { data, error } = await context.supabase.rpc("create_developer_api_key", {
    p_app_id: parsed.value.appId,
    p_name: name,
    p_key_prefix: secret.slice(0, 16),
    p_key_hash: hash,
  });
  if (error) {
    if (error.code === "P0002") {
      return NextResponse.json({ error: "The selected application was not found." }, { status: 404 });
    }
    if (error.code === "54000") {
      return NextResponse.json({ error: "Each application can have at most five active API keys." }, { status: 409 });
    }
    console.error("vornokia_developer_api_key_create_failed", { code: error.code });
    return NextResponse.json({ error: "The API key could not be created." }, { status: 500 });
  }

  const key = Array.isArray(data) ? data[0] : data;
  if (!key || !isRecord(key) || typeof key.id !== "string") {
    console.error("vornokia_developer_api_key_create_invalid_result");
    return NextResponse.json({ error: "The API key could not be created." }, { status: 500 });
  }
  return NextResponse.json(
    { key: { ...key, secret }, warning: "Copy this secret now. It cannot be shown again." },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const context = await getAuthenticatedContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const parsed = await readJsonBody(request, 4_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  if (!isRecord(parsed.value) || typeof parsed.value.keyId !== "string" || !uuidPattern.test(parsed.value.keyId)) {
    return NextResponse.json({ error: "Choose a valid API key to revoke." }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc("revoke_developer_api_key", {
    p_key_id: parsed.value.keyId,
  });
  if (error) {
    console.error("vornokia_developer_api_key_revoke_failed", { code: error.code });
    return NextResponse.json({ error: "The API key could not be revoked." }, { status: 500 });
  }
  if (data !== true) {
    return NextResponse.json({ error: "The API key was not found or has already been revoked." }, { status: 404 });
  }
  return NextResponse.json({ revoked: true }, { headers: { "Cache-Control": "no-store" } });
}
