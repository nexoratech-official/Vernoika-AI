import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function DELETE() {
  try {
    if (!getSupabaseConfig()) {
      return NextResponse.json(
        { error: "Account data services are not configured." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user) {
      return NextResponse.json(
        { error: "Sign in to manage your conversation data." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { error } = await supabase.rpc("delete_my_chat_history");
    if (error) {
      return NextResponse.json(
        { error: "Conversation history could not be deleted." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { deleted: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Account data services are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
