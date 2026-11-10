"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type AuthActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  redirectToWorkspace?: boolean;
};

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const email = readFormValue(formData, "email");
  const password = formData.get("password");
  if (!isValidEmail(email) || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return { ok: false, error: "Enter a valid email address and password." };
  }

  try {
    if (!getSupabaseConfig()) {
      return { ok: false, error: "Authentication is not configured yet." };
    }
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, error: "Sign-in failed. Check your email and password." };
    }
    return { ok: true, redirectToWorkspace: true };
  } catch {
    return { ok: false, error: "Sign-in is temporarily unavailable. Please try again." };
  }
}

export async function signUpAction(formData: FormData): Promise<AuthActionResult> {
  const displayName = readFormValue(formData, "name");
  const email = readFormValue(formData, "email");
  const password = formData.get("password");
  if (
    !displayName ||
    displayName.length > 80 ||
    !isValidEmail(email) ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    return { ok: false, error: "Enter a name, valid email, and password between 8 and 128 characters." };
  }

  try {
    if (!getSupabaseConfig()) {
      return { ok: false, error: "Authentication is not configured yet." };
    }
    const appUrl = process.env.APP_URL?.trim() || "http://localhost:3000";
    let emailRedirectTo: string;
    try {
      const parsedAppUrl = new URL(appUrl);
      const isLoopback =
        parsedAppUrl.hostname === "localhost" ||
        parsedAppUrl.hostname === "127.0.0.1" ||
        parsedAppUrl.hostname === "[::1]";
      if (parsedAppUrl.protocol !== "https:" && !(parsedAppUrl.protocol === "http:" && isLoopback)) {
        return { ok: false, error: "APP_URL must use HTTPS outside local development." };
      }
      if (
        parsedAppUrl.username ||
        parsedAppUrl.password ||
        parsedAppUrl.search ||
        parsedAppUrl.hash
      ) {
        return { ok: false, error: "APP_URL must not include credentials, query parameters, or a fragment." };
      }
      emailRedirectTo = new URL("/auth/callback?next=/app", parsedAppUrl.origin).toString();
    } catch {
      return { ok: false, error: "APP_URL must be a valid absolute URL." };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo,
      },
    });
    if (error) {
      return { ok: false, error: "Account creation failed. Check your details and try again." };
    }
    if (!data.session) {
      return {
        ok: true,
        message: "Check your email for a confirmation link before signing in.",
      };
    }
    return { ok: true, redirectToWorkspace: true };
  } catch {
    return { ok: false, error: "Account creation is temporarily unavailable. Please try again." };
  }
}

export async function signOutAction(): Promise<AuthActionResult> {
  try {
    if (!getSupabaseConfig()) return { ok: true };
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, error: "Sign-out failed. Please try again." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Sign-out is temporarily unavailable. Please try again." };
  }
}
