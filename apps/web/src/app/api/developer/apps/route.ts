import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/http/read-json-body";
import { getAuthenticatedContext, hasSameOrigin } from "@/lib/supabase/authenticated-context";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET() {
  const context = await getAuthenticatedContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const { data, error } = await context.supabase
    .from("developer_apps")
    .select("id, name, created_at")
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("vornokia_developer_apps_read_failed", { code: error.code });
    return NextResponse.json({ error: "Developer applications could not be loaded." }, { status: 500 });
  }
  return NextResponse.json({ apps: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
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
  if (!isRecord(parsed.value) || typeof parsed.value.name !== "string") {
    return NextResponse.json({ error: "Enter an application name." }, { status: 400 });
  }
  const name = parsed.value.name.trim();
  if (name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: "Application names must be between 1 and 80 characters." }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("developer_apps")
    .insert({ user_id: context.user.id, name })
    .select("id, name, created_at")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "An application with this name already exists." }, { status: 409 });
    }
    console.error("vornokia_developer_app_create_failed", { code: error?.code ?? "missing_result" });
    return NextResponse.json({ error: "The developer application could not be registered." }, { status: 500 });
  }

  return NextResponse.json({ app: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
