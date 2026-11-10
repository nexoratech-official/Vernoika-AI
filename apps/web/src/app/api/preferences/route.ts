import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/http/read-json-body";
import { getAuthenticatedContext, hasSameOrigin } from "@/lib/supabase/authenticated-context";

const defaults = {
  memory_enabled: false,
  personalization_enabled: false,
  response_style: "balanced",
};

const allowedStyles = new Set(["concise", "balanced", "detailed"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET() {
  const context = await getAuthenticatedContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const { data, error } = await context.supabase
    .from("user_preferences")
    .select("memory_enabled, personalization_enabled, response_style")
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Preferences could not be loaded." }, { status: 500 });
  }

  return NextResponse.json(data ?? defaults, {
    headers: { "Cache-Control": "private, no-store" },
  });
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
  const payload = parsed.value;
  if (
    !isRecord(payload) ||
    typeof payload.memory_enabled !== "boolean" ||
    typeof payload.personalization_enabled !== "boolean" ||
    typeof payload.response_style !== "string" ||
    !allowedStyles.has(payload.response_style)
  ) {
    return NextResponse.json({ error: "Preference values are invalid." }, { status: 400 });
  }

  const preferences = {
    user_id: context.user.id,
    memory_enabled: payload.memory_enabled,
    personalization_enabled: payload.personalization_enabled,
    response_style: payload.response_style,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await context.supabase
    .from("user_preferences")
    .upsert(preferences)
    .select("memory_enabled, personalization_enabled, response_style")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Preferences could not be saved." }, { status: 500 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
