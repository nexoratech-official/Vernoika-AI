import { AuthForm } from "@/components/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Suspense } from "react";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<div className="auth-page"><p>Loading sign-in…</p></div>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  const messages: Record<string, string> = {
    auth_not_configured: "Authentication is not configured for this app.",
    auth_temporarily_unavailable: "Account confirmation is temporarily unavailable.",
    confirmation_failed: "The confirmation link is invalid or has expired. Request a new one and try again.",
  };
  const initialError = typeof error === "string" ? messages[error] ?? "" : "";
  return <AuthForm mode="login" authConfigured={isSupabaseConfigured()} initialError={initialError} />;
}
