import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/http/read-json-body";
import { getAuthenticatedContext, hasSameOrigin } from "@/lib/supabase/authenticated-context";

const maxTitleLength = 120;
const maxContentLength = 4000;
const categories = new Set(["general", "preference", "goal", "work", "personal"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidMemory(value: unknown): value is {
  [key: string]: unknown;
  title: string;
  content: string;
  category: string;
} {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    value.title.trim().length <= maxTitleLength &&
    typeof value.content === "string" &&
    value.content.trim().length > 0 &&
    value.content.trim().length <= maxContentLength &&
    typeof value.category === "string" &&
    categories.has(value.category)
  );
}

export async function GET() {
  const context = await getAuthenticatedContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  const { data, error } = await context.supabase
    .from("memory_items")
    .select("id, title, content, category, created_at, updated_at")
    .eq("user_id", context.user.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: "Saved memories could not be loaded." }, { status: 500 });
  }
  return NextResponse.json({ memories: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const context = await getAuthenticatedContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  const parsed = await readJsonBody(request, 16_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const payload = parsed.value;
  if (!isValidMemory(payload)) {
    return NextResponse.json({ error: "Enter a title, memory, and valid category." }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("memory_items")
    .insert({
      user_id: context.user.id,
      title: payload.title.trim(),
      content: payload.content.trim(),
      category: payload.category,
    })
    .select("id, title, content, category, created_at, updated_at")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Memory could not be saved." }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const context = await getAuthenticatedContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  const parsed = await readJsonBody(request, 16_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const payload = parsed.value;
  if (!isRecord(payload) || typeof payload.id !== "string" || !isValidMemory(payload)) {
    return NextResponse.json({ error: "Memory details are invalid." }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("memory_items")
    .update({
      title: payload.title.trim(),
      content: payload.content.trim(),
      category: payload.category,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.id)
    .eq("user_id", context.user.id)
    .select("id, title, content, category, created_at, updated_at")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Memory could not be updated." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Memory not found." }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
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
  if (!isRecord(payload) || (payload.id !== undefined && typeof payload.id !== "string")) {
    return NextResponse.json({ error: "Memory identifier is invalid." }, { status: 400 });
  }

  let query = context.supabase.from("memory_items").delete().eq("user_id", context.user.id);
  if (typeof payload.id === "string") query = query.eq("id", payload.id);
  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: "Memory could not be deleted." }, { status: 500 });
  }
  return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
}
