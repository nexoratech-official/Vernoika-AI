import { ArrowUpRight, Camera, Mail, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const authConfigured = isSupabaseConfigured();
  let displayName = "Vornokia user";
  let email = "hello@example.com";

  if (authConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) redirect("/login");
    const metadataName = data.user.user_metadata?.display_name;
    displayName =
      typeof metadataName === "string" && metadataName.trim()
        ? metadataName.trim()
        : data.user.email?.split("@")[0] ?? "Vornokia user";
    email = data.user.email ?? "Not available";
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <div className="eyebrow"><span /> YOUR ACCOUNT</div>
        <h1>Profile</h1>
        <p>Manage the details associated with your Vornokia workspace.</p>
      </div>
      <div className="profile-layout">
        <div className="profile-card">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">{displayName.charAt(0).toUpperCase()}</div>
            <button className="profile-avatar-edit" type="button" aria-label="Profile photo is not available in preview"><Camera size={15} /></button>
          </div>
          <h2>{displayName}</h2>
          <p>{authConfigured ? "Vornokia account" : "Preview account"}</p>
          <span className="profile-plan"><SparkleIcon /> Personal workspace</span>
        </div>
        <div className="settings-card profile-details">
          <div className="settings-card-heading">
            <span className="settings-heading-icon"><UserRound size={17} /></span>
            <div><h2>Personal details</h2><p>{authConfigured ? "Your verified account details." : "These details are shown only in this preview."}</p></div>
          </div>
          <div className="profile-fields">
            <label className="field-label">Display name<input defaultValue={displayName} readOnly /></label>
            <label className="field-label">Email address<span className="input-with-icon"><Mail size={15} /><input defaultValue={email} readOnly /></span></label>
          </div>
          <div className="profile-preview-info"><ShieldCheck size={16} /> Profile editing is not enabled yet.</div>
        </div>
      </div>
      <div className="settings-card account-status-card">
        <div className="settings-card-heading">
          <span className="settings-heading-icon"><ShieldCheck size={17} /></span>
          <div><h2>Account status</h2><p>{authConfigured ? "Authentication is provided by Supabase." : "Sign-in and cloud services are not configured."}</p></div>
        </div>
        <span className="preview-status"><span /> {authConfigured ? "Connected" : "Preview only"}</span>
        {!authConfigured && <Link className="subtle-link" href="/login">View sign-in screen <ArrowUpRight size={14} /></Link>}
      </div>
    </section>
  );
}

function SparkleIcon() {
  return <span aria-hidden="true">✦</span>;
}
