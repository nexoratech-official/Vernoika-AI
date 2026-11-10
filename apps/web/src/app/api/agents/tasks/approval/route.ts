import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/http/read-json-body";
import { getAuthenticatedContext, hasSameOrigin } from "@/lib/supabase/authenticated-context";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
    typeof payload.taskId !== "string" ||
    (payload.decision !== "approved" && payload.decision !== "rejected")
  ) {
    return NextResponse.json({ error: "Approval decision is invalid." }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("agent_tasks")
    .update({ status: payload.decision, updated_at: new Date().toISOString() })
    .eq("id", payload.taskId)
    .eq("user_id", context.user.id)
    .eq("status", "awaiting_approval")
    .select("id, status")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "The approval decision could not be saved." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Task is unavailable or has already been reviewed." }, { status: 409 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
