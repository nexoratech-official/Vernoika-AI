"use client";

import { AlertOctagon, AppWindow, FileText, FolderOpen, LockKeyhole, Play, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState, useSyncExternalStore } from "react";

type DesktopPermission = "readSelectedFiles" | "saveNewFiles" | "launchApprovedApps";

type DesktopStatus = {
  permissions: {
    readSelectedFiles: boolean;
    saveNewFiles: boolean;
    launchApprovedApps: boolean;
  };
  emergencyStopped: boolean;
  approvedApps: Array<{ id: string; name: string }>;
};

type SelectedTextFile = { name: string; text: string };

const permissionOptions: Array<{ key: DesktopPermission; label: string; detail: string }> = [
  {
    key: "readSelectedFiles",
    label: "Read a selected text file",
    detail: "Only a file you select in the native picker; text is attached to chat only after you press Send.",
  },
  {
    key: "saveNewFiles",
    label: "Save new files",
    detail: "Only new .txt or .md files at a location you select. Existing files cannot be overwritten.",
  },
  {
    key: "launchApprovedApps",
    label: "Launch approved apps",
    detail: "Only apps in your local allowlist, with a native confirmation before each launch.",
  },
];

function isDesktopStatus(value: unknown): value is DesktopStatus {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const permissions = record.permissions;
  return (
    typeof record.emergencyStopped === "boolean" &&
    typeof permissions === "object" &&
    permissions !== null &&
    typeof (permissions as Record<string, unknown>).readSelectedFiles === "boolean" &&
    typeof (permissions as Record<string, unknown>).saveNewFiles === "boolean" &&
    typeof (permissions as Record<string, unknown>).launchApprovedApps === "boolean" &&
    Array.isArray(record.approvedApps) &&
    record.approvedApps.every((app) =>
      typeof app === "object" &&
      app !== null &&
      typeof (app as Record<string, unknown>).id === "string" &&
      typeof (app as Record<string, unknown>).name === "string",
    )
  );
}

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "The desktop action could not be completed.";
}

function subscribeToDesktopAvailability() {
  return () => {};
}

function getDesktopAvailability() {
  return typeof window !== "undefined" && isTauri();
}

export function DesktopControlPanel() {
  const desktopAvailable = useSyncExternalStore(
    subscribeToDesktopAvailability,
    getDesktopAvailability,
    () => false,
  );
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveText, setSaveText] = useState("");
  const [selectedFile, setSelectedFile] = useState<SelectedTextFile | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    invoke<unknown>("device_status")
      .then((result) => {
        if (!isDesktopStatus(result)) throw new Error("Desktop permissions returned an invalid response.");
        if (active) setStatus(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorText(loadError));
      });
    return () => { active = false; };
  }, []);

  async function runAction<T>(action: () => Promise<T>, apply?: (result: T) => void) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      apply?.(result);
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setBusy(false);
    }
  }

  function applyStatus(result: unknown) {
    if (!isDesktopStatus(result)) throw new Error("Desktop permissions returned an invalid response.");
    setStatus(result);
  }

  async function changePermission(permission: DesktopPermission, enabled: boolean) {
    await runAction(
      () => invoke<unknown>("set_device_permission", { permission, enabled }),
      applyStatus,
    );
  }

  async function chooseTextFile() {
    await runAction(async () => {
      const file = await invoke<SelectedTextFile | null>("read_selected_text_file");
      if (!file) return;
      if (file.text.length > 16_000) throw new Error("The selected text exceeds the chat attachment limit.");
      setSelectedFile(file);
      setNotice(`${file.name} is ready. It will only be sent if you attach it in chat and press Send.`);
    });
  }

  async function saveNewFile() {
    await runAction(async () => {
      const savedName = await invoke<string | null>("save_new_text_file", { content: saveText });
      if (savedName) setNotice(`Saved new file: ${savedName}.`);
    });
  }

  async function addApplication() {
    await runAction(
      () => invoke<unknown>("add_approved_application"),
      applyStatus,
    );
  }

  async function launchApplication(id: string) {
    await runAction(() => invoke("launch_approved_application", { applicationId: id }));
  }

  async function removeApplication(id: string) {
    await runAction(
      () => invoke<unknown>("remove_approved_application", { applicationId: id }),
      applyStatus,
    );
  }

  async function stopDeviceActions() {
    await runAction(
      () => invoke<unknown>("emergency_stop"),
      applyStatus,
    );
  }

  async function resetEmergencyStop() {
    await runAction(
      () => invoke<unknown>("reset_emergency_stop"),
      applyStatus,
    );
  }

  if (!desktopAvailable) return null;

  return (
    <div className="settings-card desktop-control-card">
      <div className="settings-card-heading">
        <span className="settings-heading-icon"><ShieldCheck size={17} /></span>
        <div><h2>Desktop permissions</h2><p>Local device actions stay off until you enable them and approve each action.</p></div>
      </div>

      <div className="desktop-security-note">
        <LockKeyhole size={16} />
        <p>These controls are provided by the signed desktop app. File access is limited to native file pickers; no arbitrary commands or keyboard/mouse automation are enabled. Permissions reset when the app closes.</p>
      </div>

      <div className="settings-list">
        {permissionOptions.map((option) => (
          <div className="setting-row" key={option.key}>
            <span className="setting-icon"><ShieldCheck size={16} /></span>
            <div className="setting-copy"><strong>{option.label}</strong><p>{option.detail}</p></div>
            <button
              className={`toggle-switch${status?.permissions[option.key] ? " toggle-on" : ""}`}
              type="button"
              role="switch"
              aria-checked={status?.permissions[option.key] ?? false}
              aria-label={option.label}
              disabled={!status || busy || status.emergencyStopped}
              onClick={() => void changePermission(option.key, !status?.permissions[option.key])}
            ><span /></button>
          </div>
        ))}
      </div>

      {status?.emergencyStopped ? (
        <div className="desktop-action-row">
          <p className="desktop-stop-state"><AlertOctagon size={15} /> Emergency stop is active. All device permissions are off and the app allowlist was cleared.</p>
          <button className="button button-secondary" type="button" disabled={busy} onClick={() => void resetEmergencyStop()}>Reset stop</button>
        </div>
      ) : (
        <button className="button button-danger-outline desktop-stop-button" type="button" disabled={!status || busy} onClick={() => void stopDeviceActions()}>
          <AlertOctagon size={15} /> Emergency stop
        </button>
      )}

      <div className="desktop-tools-grid">
        <div className="desktop-tool-card">
          <div className="desktop-tool-heading"><FolderOpen size={16} /><strong>Selected files</strong></div>
          <p>Read a UTF-8 text file of up to 16,000 characters, or save new text without overwriting existing files.</p>
          <button className="button button-secondary" type="button" disabled={!status?.permissions.readSelectedFiles || status.emergencyStopped || busy} onClick={() => void chooseTextFile()}>
            <FileText size={14} /> Select text file
          </button>
          <label className="desktop-save-label" htmlFor="desktop-save-text">Text to save as a new file</label>
          <textarea id="desktop-save-text" className="desktop-file-content" value={saveText} onChange={(event) => setSaveText(event.target.value)} maxLength={1_000_000} rows={4} disabled={!status?.permissions.saveNewFiles || status.emergencyStopped || busy} />
          <button className="button button-secondary" type="button" disabled={!saveText || !status?.permissions.saveNewFiles || status.emergencyStopped || busy} onClick={() => void saveNewFile()}>
            <Save size={14} /> Save new file
          </button>
          {selectedFile && <details className="desktop-file-preview"><summary>Locally opened: {selectedFile.name}</summary><pre>{selectedFile.text}</pre></details>}
        </div>

        <div className="desktop-tool-card">
          <div className="desktop-tool-heading"><AppWindow size={16} /><strong>Approved applications</strong></div>
          <p>Applications are selected locally and stored on this device. Launching never supplies arguments and always asks first.</p>
          <button className="button button-secondary" type="button" disabled={!status?.permissions.launchApprovedApps || status.emergencyStopped || busy} onClick={() => void addApplication()}>
            <Plus size={14} /> Add application
          </button>
          {status?.approvedApps.map((application) => (
            <div className="desktop-approved-app" key={application.id}>
              <span>{application.name}</span>
              <button className="icon-button" type="button" aria-label={`Launch ${application.name}`} disabled={!status.permissions.launchApprovedApps || status.emergencyStopped || busy} onClick={() => void launchApplication(application.id)}><Play size={14} /></button>
              <button className="icon-button" type="button" aria-label={`Remove ${application.name}`} disabled={busy} onClick={() => void removeApplication(application.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          {status?.approvedApps.length === 0 && <p className="desktop-empty-apps">No applications are approved on this device.</p>}
        </div>
      </div>

      {error && <p className="inline-error" role="alert">{error}</p>}
      {notice && <p className="settings-delete-status" role="status">{notice}</p>}
    </div>
  );
}
