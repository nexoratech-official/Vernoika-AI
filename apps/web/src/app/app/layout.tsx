import { AppShell } from "@/components/app-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isModelGatewayConfigured } from "@/lib/intelligence/model-gateway";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

export default function WorkspaceLayout({ children }: LayoutProps<"/app">) {
  return (
    <Suspense fallback={<div className="app-content" aria-busy="true">Loading your workspace…</div>}>
      <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>
    </Suspense>
  );
}

async function AuthenticatedWorkspace({ children }: { children: ReactNode }) {
  await connection();
  const authConfigured = isSupabaseConfigured();
  let identity: { displayName: string; email: string } | null = null;

  if (authConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) redirect("/login");

    const displayName = data.user.user_metadata?.display_name;
    identity = {
      displayName:
        typeof displayName === "string" && displayName.trim()
          ? displayName.trim()
          : data.user.email?.split("@")[0] ?? "Vornokia user",
      email: data.user.email ?? "",
    };
  }

  return (
    <AppShell
      identity={identity}
      authenticated={authConfigured}
      aiConfigured={authConfigured && isModelGatewayConfigured()}
    >
      {children}
    </AppShell>
  );
}
