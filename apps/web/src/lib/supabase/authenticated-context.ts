import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function getAuthenticatedContext() {
  try {
    if (!getSupabaseConfig()) {
      return { error: "Account data services are not configured.", status: 503 as const };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { error: "Sign in to continue.", status: 401 as const };
    }
    return { supabase, user: data.user } as const;
  } catch {
    return { error: "Account data services are temporarily unavailable.", status: 503 as const };
  }
}

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}
