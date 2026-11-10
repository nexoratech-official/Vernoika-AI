"use client";

import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "./brand-mark";
import { ThemeControl } from "./theme-control";
import { signInAction, signUpAction } from "@/app/actions/auth";

export function AuthForm({
  mode,
  authConfigured,
  initialError = "",
}: {
  mode: "login" | "register";
  authConfigured: boolean;
  initialError?: string;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!authConfigured) {
      router.push("/app");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const result = isRegister
        ? await signUpAction(formData)
        : await signInAction(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.redirectToWorkspace) {
        router.push("/app");
        router.refresh();
      } else if (result.message) {
        setNotice(result.message);
      }
    } catch {
      setError("The request could not be completed. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-background-glow" aria-hidden="true" />
      <header className="auth-header">
        <Link href="/" aria-label="Vornokia home"><BrandMark /></Link>
        <div className="auth-header-actions">
          <ThemeControl />
          <Link className="auth-back-link" href="/">
            <ArrowLeft size={15} /> Back to home
          </Link>
        </div>
      </header>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card-mark"><BrandMark compact /></div>
        <div className="eyebrow auth-eyebrow"><span /> Your workspace, in one place</div>
        <h1 id="auth-title">{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-intro">
          {isRegister
            ? "Start exploring a calmer, more connected way to work."
            : "Sign in to pick up where your ideas left off."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <label className="field-label">
              Your name
              <input autoComplete="name" name="name" placeholder="Alex Morgan" required />
            </label>
          )}
          <label className="field-label">
            Email address
            <input
              autoComplete="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </label>
          <label className="field-label">
            Password
            <span className="password-field">
              <input
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={8}
                maxLength={128}
                name="password"
                placeholder="At least 8 characters"
                required
                type={showPassword ? "text" : "password"}
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          {!isRegister && (
            <div className="auth-form-meta">
              <label className="checkbox-label"><input type="checkbox" /> Remember me</label>
              <button className="text-button" type="button" disabled title="Password recovery is not available in preview">
                Forgot password?
              </button>
            </div>
          )}
          <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            {!isSubmitting && <ArrowRight size={17} />}
          </button>
          {error && <p className="form-message form-message-error" role="alert">{error}</p>}
          {notice && <p className="form-message form-message-success" role="status">{notice}</p>}
        </form>

        <p className="auth-switch">
          {isRegister ? "Already have an account?" : "New to Vornokia?"}{" "}
          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <div className="auth-preview-note">
          <ShieldCheck size={16} />
          <span>
            {authConfigured
              ? "Secure account sessions are handled by Supabase."
              : "Preview only — add Supabase settings to enable accounts."}
          </span>
        </div>
      </section>
      <footer className="auth-footer">© 2026 Vornokia AI · Built around your control</footer>
    </main>
  );
}
