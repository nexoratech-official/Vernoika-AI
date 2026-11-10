import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
  }

  try {
    if (!getSupabaseConfig()) {
      return NextResponse.redirect(new URL("/login?error=auth_not_configured", request.url));
    }
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
    }

    const next = request.nextUrl.searchParams.get("next");
    let destination = new URL("/app", request.url);
    if (next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) {
      const candidate = new URL(next, request.url);
      if (candidate.origin === request.nextUrl.origin) destination = candidate;
    }
    return NextResponse.redirect(destination);
  } catch {
    return NextResponse.redirect(new URL("/login?error=auth_temporarily_unavailable", request.url));
  }
}
