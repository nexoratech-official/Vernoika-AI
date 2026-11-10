"use client";

import { Download, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type MemoryCategory = "general" | "preference" | "goal" | "work" | "personal";
type MemoryItem = {
  id: string;
  title: string;
  content: string;
  category: MemoryCategory;
  created_at: string;
  updated_at: string;
};

const storageKey = "vornokia.memory.v1";
const categoryLabels: Record<MemoryCategory, string> = {
  general: "General",
  preference: "Preference",
  goal: "Goal",
  work: "Work",
  personal: "Personal",
};

function isMemoryItem(value: unknown): value is MemoryItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.content === "string" &&
    typeof item.category === "string" &&
    item.category in categoryLabels &&
    typeof item.created_at === "string" &&
    typeof item.updated_at === "string"
  );
}

function readLocalMemories() {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(stored) ? stored.filter(isMemoryItem) : [];
  } catch {
    throw new Error("Saved preview memories could not be read from browser storage.");
  }
}

export function MemoryPanel({ databaseConnected }: { databaseConnected: boolean }) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("general");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    async function loadMemories() {
      try {
        if (!databaseConnected) {
          if (active) setMemories(readLocalMemories());
          return;
        }
        const response = await fetch("/api/memories", { cache: "no-store" });
        const result: unknown = await response.json();
        if (!response.ok || typeof result !== "object" || result === null || !Array.isArray((result as { memories?: unknown }).memories)) {
          throw new Error(
            typeof result === "object" && result !== null && typeof (result as { error?: unknown }).error === "string"
              ? (result as { error: string }).error
              : "Saved memories could not be loaded.",
          );
        }
        if (active) setMemories((result as { memories: unknown[] }).memories.filter(isMemoryItem));
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Saved memories could not be loaded.");
      } finally {
        if (active) setIsReady(true);
      }
    }
    void loadMemories();
    return () => { active = false; };
  }, [databaseConnected]);

  function persistPreview(items: MemoryItem[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      throw new Error("Browser storage is unavailable. Your memory changes were not saved.");
    }
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setCategory("general");
  }

  function editMemory(memory: MemoryItem) {
    setEditingId(memory.id);
    setTitle(memory.title);
    setContent(memory.content);
    setCategory(memory.category);
    setStatus("");
  }

  async function saveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsSaving(true);
    const payload = { title: title.trim(), content: content.trim(), category };
    try {
      let updated: MemoryItem;
      if (databaseConnected) {
        const response = await fetch(editingId ? "/api/memories" : "/api/memories", {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
        });
        const result: unknown = await response.json();
        if (!response.ok || !isMemoryItem(result)) {
          throw new Error(
            typeof result === "object" && result !== null && typeof (result as { error?: unknown }).error === "string"
              ? (result as { error: string }).error
              : "Memory could not be saved.",
          );
        }
        updated = result;
      } else {
        updated = {
          id: editingId ?? crypto.randomUUID(),
          ...payload,
          created_at: memories.find((item) => item.id === editingId)?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      const next = editingId
        ? memories.map((item) => item.id === editingId ? updated : item)
        : [updated, ...memories];
      if (!databaseConnected) persistPreview(next);
      setMemories(next);
      resetForm();
      setStatus(editingId ? "Memory updated." : "Memory saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Memory could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteMemory(id: string) {
    if (!window.confirm("Delete this saved memory?")) return;
    setStatus("");
    try {
      if (databaseConnected) {
        const response = await fetch("/api/memories", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const result: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            typeof result === "object" && result !== null && typeof (result as { error?: unknown }).error === "string"
              ? (result as { error: string }).error
              : "Memory could not be deleted.",
          );
        }
      }
      const next = memories.filter((item) => item.id !== id);
      if (!databaseConnected) persistPreview(next);
      setMemories(next);
      if (editingId === id) resetForm();
      setStatus("Memory deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Memory could not be deleted.");
    }
  }

  async function deleteAllMemories() {
    if (!memories.length || !window.confirm("Permanently delete all saved memories?")) return;
    setStatus("");
    try {
      if (databaseConnected) {
        const response = await fetch("/api/memories", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const result: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            typeof result === "object" && result !== null && typeof (result as { error?: unknown }).error === "string"
              ? (result as { error: string }).error
              : "Memories could not be deleted.",
          );
        }
      }
      if (!databaseConnected) persistPreview([]);
      setMemories([]);
      resetForm();
      setStatus("All saved memories were deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Memories could not be deleted.");
    }
  }

  function exportMemories() {
    try {
      const file = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), memories }, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "vornokia-memory-export.json";
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Memory export downloaded.");
    } catch {
      setStatus("Memory export could not be created.");
    }
  }

  return (
    <section className="settings-page memory-page">
      <div className="page-heading">
        <div className="eyebrow"><span /> YOUR CONTEXT, YOUR CONTROL</div>
        <h1>Memory</h1>
        <p>Save only what you want Vornokia to remember. Review, edit, export, or delete it at any time.</p>
      </div>

      <div className="privacy-callout">
        <span aria-hidden="true">i</span>
        <div>
          <strong>Memory is off by default.</strong>
          <p>Saved items are only added to chat context when Memory is enabled in Settings. Memories are never created from chat automatically.</p>
        </div>
      </div>

      <div className="memory-toolbar">
        <span>{isReady ? `${memories.length} saved ${memories.length === 1 ? "memory" : "memories"}` : "Loading saved memories…"}</span>
        <div>
          <button className="button button-secondary" type="button" onClick={exportMemories} disabled={!isReady || !memories.length}>
            <Download size={15} /> Export
          </button>
          <button className="button button-danger-outline" type="button" onClick={() => void deleteAllMemories()} disabled={!isReady || !memories.length}>
            <Trash2 size={14} /> Delete all
          </button>
        </div>
      </div>

      <div className="memory-layout">
        <form className="settings-card memory-form" onSubmit={(event) => void saveMemory(event)}>
          <div className="settings-card-heading">
            <span className="settings-heading-icon"><Plus size={17} /></span>
            <div><h2>{editingId ? "Edit memory" : "Add a memory"}</h2><p>Only save information you want personalized responses to use.</p></div>
          </div>
          <label className="field-label">Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="e.g. Current project" />
          </label>
          <label className="field-label">Memory
            <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={4000} required rows={5} placeholder="Write the detail you'd like Vornokia to remember…" />
          </label>
          <label className="field-label">Category
            <select value={category} onChange={(event) => setCategory(event.target.value as MemoryCategory)}>
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="memory-form-actions">
            {editingId && <button className="button button-secondary" type="button" onClick={resetForm}><X size={14} /> Cancel</button>}
            <button className="button button-primary" type="submit" disabled={isSaving}>
              <Save size={14} /> {isSaving ? "Saving…" : editingId ? "Save changes" : "Save memory"}
            </button>
          </div>
        </form>

        <div className="memory-list">
          {!isReady ? (
            <div className="settings-card memory-empty">Loading your saved memories…</div>
          ) : memories.length ? memories.map((memory) => (
            <article className="settings-card memory-item" key={memory.id}>
              <div className="memory-item-heading">
                <span className="memory-category">{categoryLabels[memory.category]}</span>
                <div>
                  <button className="icon-button" type="button" aria-label={`Edit ${memory.title}`} onClick={() => editMemory(memory)}><Pencil size={15} /></button>
                  <button className="icon-button memory-delete" type="button" aria-label={`Delete ${memory.title}`} onClick={() => void deleteMemory(memory.id)}><Trash2 size={15} /></button>
                </div>
              </div>
              <h2>{memory.title}</h2>
              <p>{memory.content}</p>
              <time dateTime={memory.updated_at}>Updated {new Date(memory.updated_at).toLocaleDateString()}</time>
            </article>
          )) : (
            <div className="settings-card memory-empty">
              <h2>No saved memories yet</h2>
              <p>Add a preference, goal, or useful detail here. You stay in control of what is stored.</p>
            </div>
          )}
        </div>
      </div>
      {status && <p className="settings-delete-status" role="status">{status}</p>}
      {!databaseConnected && <p className="configuration-notice">Preview mode: saved memories stay in this browser and are not sent to an AI model.</p>}
    </section>
  );
}
