"use client";

import { Brain, Eye, LockKeyhole, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { saveMessages } from "@/lib/conversation-store";
import { DesktopControlPanel } from "@/components/desktop-control-panel";

type Preferences = {
  memory_enabled: boolean;
  personalization_enabled: boolean;
  response_style: "concise" | "balanced" | "detailed";
};

const defaultPreferences: Preferences = {
  memory_enabled: false,
  personalization_enabled: false,
  response_style: "balanced",
};
const preferenceStorageKey = "vornokia.preferences.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPreferences(value: unknown): value is Preferences {
  return (
    isRecord(value) &&
    typeof value.memory_enabled === "boolean" &&
    typeof value.personalization_enabled === "boolean" &&
    (value.response_style === "concise" || value.response_style === "balanced" || value.response_style === "detailed")
  );
}

function readPreviewPreferences(): Preferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(preferenceStorageKey) ?? "null");
    return isPreferences(value) ? value : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

export function SettingsPanel({ databaseConnected }: { databaseConnected: boolean }) {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteState, setDeleteState] = useState("");
  const [preferenceState, setPreferenceState] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadPreferences() {
      try {
        if (!databaseConnected) {
          if (active) setPreferences(readPreviewPreferences());
          return;
        }
        const response = await fetch("/api/preferences", { cache: "no-store" });
        const result: unknown = await response.json();
        if (!response.ok || !isPreferences(result)) {
          throw new Error(
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "Preferences could not be loaded. Apply the latest database migration.",
          );
        }
        if (active) setPreferences(result);
      } catch (error) {
        if (active) setPreferenceState(error instanceof Error ? error.message : "Preferences could not be loaded.");
      } finally {
        if (active) setIsReady(true);
      }
    }
    void loadPreferences();
    return () => { active = false; };
  }, [databaseConnected]);

  async function savePreferences(next: Preferences) {
    setPreferenceState("");
    setIsSaving(true);
    try {
      if (databaseConnected) {
        const response = await fetch("/api/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const result: unknown = await response.json();
        if (!response.ok || !isPreferences(result)) {
          throw new Error(
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "Preferences could not be saved.",
          );
        }
        setPreferences(result);
      } else {
        localStorage.setItem(preferenceStorageKey, JSON.stringify(next));
        setPreferences(next);
      }
      setPreferenceState("Preferences saved.");
    } catch (error) {
      setPreferenceState(error instanceof Error ? error.message : "Preferences could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function clearHistory() {
    const confirmation = databaseConnected
      ? "Permanently delete all your conversations and usage history?"
      : "Clear the preview conversation saved in this browser?";
    if (!window.confirm(confirmation)) return;

    setDeleteState("");
    setIsDeleting(true);
    try {
      if (databaseConnected) {
        const response = await fetch("/api/conversations", { method: "DELETE" });
        const result: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "Conversation history could not be deleted.",
          );
        }
      } else {
        saveMessages([]);
      }
      setDeleteState("Conversation history was deleted.");
    } catch (error) {
      setDeleteState(
        error instanceof Error ? error.message : "Conversation history could not be deleted.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <div className="eyebrow"><span /> MAKE IT YOURS</div>
        <h1>Settings</h1>
        <p>Thoughtful defaults, with you in control.</p>
      </div>

      <DesktopControlPanel />

      <div className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-heading-icon"><SlidersHorizontal size={17} /></span>
          <div><h2>Personalization</h2><p>Choose whether Vornokia can use your preferences and saved context.</p></div>
        </div>
        <div className="settings-list">
          <div className="setting-row">
            <span className="setting-icon"><Brain size={17} /></span>
            <div className="setting-copy"><strong>Use saved memory in chat</strong><p>Include relevant items you saved when answering. Off until you enable it.</p></div>
            <button className={`toggle-switch${preferences.memory_enabled ? " toggle-on" : ""}`} type="button" role="switch" aria-checked={preferences.memory_enabled} aria-label="Use saved memory in chat" disabled={!isReady || isSaving} onClick={() => void savePreferences({ ...preferences, memory_enabled: !preferences.memory_enabled })}><span /></button>
          </div>
          <div className="setting-row">
            <span className="setting-icon"><Sparkles size={17} /></span>
            <div className="setting-copy"><strong>Personalized responses</strong><p>Use your chosen response style when responding.</p></div>
            <button className={`toggle-switch${preferences.personalization_enabled ? " toggle-on" : ""}`} type="button" role="switch" aria-checked={preferences.personalization_enabled} aria-label="Personalized responses" disabled={!isReady || isSaving} onClick={() => void savePreferences({ ...preferences, personalization_enabled: !preferences.personalization_enabled })}><span /></button>
          </div>
          <div className="setting-row response-style-row">
            <span className="setting-icon"><Eye size={17} /></span>
            <div className="setting-copy"><strong>Response style</strong><p>Used only when personalized responses are enabled.</p></div>
            <select className="response-style-select" aria-label="Response style" value={preferences.response_style} disabled={!isReady || isSaving || !preferences.personalization_enabled} onChange={(event) => void savePreferences({ ...preferences, response_style: event.target.value as Preferences["response_style"] })}>
              <option value="concise">Concise</option>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
        </div>
        {preferenceState && <p className="settings-delete-status" role="status">{preferenceState}</p>}
        {!databaseConnected && <div className="settings-preview-note">Preview preferences are stored in this browser. No saved memory is sent to an AI model in preview mode.</div>}
      </div>

      <div className="settings-card privacy-card">
        <div className="settings-card-heading">
          <span className="settings-heading-icon"><LockKeyhole size={17} /></span>
          <div>
            <h2>Privacy &amp; data</h2>
            <p>{databaseConnected ? "Your conversations and saved information are attached to your account." : "Your preview conversation and memories stay in this browser."}</p>
          </div>
        </div>
        <div className="privacy-callout">
          <ShieldCheck size={18} />
          <div>
            <strong>You’re in control.</strong>
            <p>{databaseConnected
              ? "Memory retrieval is opt-in. You can inspect, edit, export, and delete saved memories. Chats and agent requests are processed by your configured model provider."
              : "No account, cloud sync, or model provider is connected in this preview. Preview memory is not included in simulated chat responses."}</p>
          </div>
        </div>
        <Link className="button button-secondary settings-memory-link" href="/app/memory"><Brain size={15} /> Review, export, or delete saved memories</Link>
        <div className="data-controls">
          <div>
            <strong>{databaseConnected ? "Account chat history" : "Local chat history"}</strong>
            <span>{databaseConnected ? "Supabase PostgreSQL" : "Stored in this browser only"}</span>
          </div>
          <span className="data-status"><span /> Active</span>
        </div>
        <button className="button button-danger-outline" type="button" onClick={() => void clearHistory()} disabled={isDeleting}>
          {isDeleting ? "Deleting…" : databaseConnected ? "Delete all chat history" : "Clear local chat history"}
        </button>
        {deleteState && <p className="settings-delete-status" role="status">{deleteState}</p>}
      </div>
    </section>
  );
}
