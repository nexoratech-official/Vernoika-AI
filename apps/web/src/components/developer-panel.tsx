"use client";

import { Activity, Check, Code2, Copy, KeyRound, LoaderCircle, Plus, Send, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type DeveloperApp = { id: string; name: string; created_at: string };
type DeveloperKey = {
  id: string;
  app_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  per_minute_limit: number;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};
type DeveloperUsage = {
  month_requests: number;
  input_tokens: number;
  output_tokens: number;
  active_keys: number;
  monthly_limit_per_key: number;
};
type IssuedKey = DeveloperKey & { secret: string };
type DeveloperData = {
  apps: DeveloperApp[];
  keys: DeveloperKey[];
  usage: DeveloperUsage | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readError(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function isDeveloperApp(value: unknown): value is DeveloperApp {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.created_at === "string";
}

function isDeveloperKey(value: unknown): value is DeveloperKey {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.app_id === "string" &&
    typeof value.name === "string" &&
    typeof value.key_prefix === "string" &&
    Array.isArray(value.scopes) &&
    value.scopes.every((scope) => typeof scope === "string") &&
    typeof value.per_minute_limit === "number" &&
    typeof value.created_at === "string" &&
    (typeof value.last_used_at === "string" || value.last_used_at === null) &&
    (typeof value.revoked_at === "string" || value.revoked_at === null);
}

function isIssuedKey(value: unknown): value is IssuedKey {
  return isRecord(value) &&
    typeof value.secret === "string" &&
    isDeveloperKey(value);
}

function isUsage(value: unknown): value is DeveloperUsage {
  return isRecord(value) &&
    typeof value.month_requests === "number" &&
    typeof value.input_tokens === "number" &&
    typeof value.output_tokens === "number" &&
    typeof value.active_keys === "number" &&
    typeof value.monthly_limit_per_key === "number";
}

export function DeveloperPanel({ databaseConnected }: { databaseConnected: boolean }) {
  const [apps, setApps] = useState<DeveloperApp[]>([]);
  const [keys, setKeys] = useState<DeveloperKey[]>([]);
  const [usage, setUsage] = useState<DeveloperUsage | null>(null);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [appName, setAppName] = useState("");
  const [keyName, setKeyName] = useState("");
  const [issuedKey, setIssuedKey] = useState<IssuedKey | null>(null);
  const [testKey, setTestKey] = useState("");
  const [testPrompt, setTestPrompt] = useState("");
  const [testResult, setTestResult] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [status, setStatus] = useState("");

  const activeKeys = useMemo(() => keys.filter((key) => key.revoked_at === null), [keys]);
  const selectedApp = apps.find((app) => app.id === selectedAppId) ?? apps[0] ?? null;
  const selectedKeys = selectedApp ? keys.filter((key) => key.app_id === selectedApp.id) : [];

  const loadData = useCallback(async () => {
    if (!databaseConnected) {
      return { apps: [], keys: [], usage: null } satisfies DeveloperData;
    }
    const [appsResponse, keysResponse] = await Promise.all([
      fetch("/api/developer/apps", { cache: "no-store" }),
      fetch("/api/developer/keys", { cache: "no-store" }),
    ]);
    const [appsResult, keysResult]: unknown[] = await Promise.all([
      appsResponse.json(),
      keysResponse.json(),
    ]);
    if (!appsResponse.ok || !isRecord(appsResult) || !Array.isArray(appsResult.apps)) {
      throw new Error(readError(appsResult, "Developer applications could not be loaded."));
    }
    if (!keysResponse.ok || !isRecord(keysResult) || !Array.isArray(keysResult.keys)) {
      throw new Error(readError(keysResult, "Developer API keys could not be loaded."));
    }
    const loadedApps = appsResult.apps.filter(isDeveloperApp);
    const loadedKeys = keysResult.keys.filter(isDeveloperKey);
    return {
      apps: loadedApps,
      keys: loadedKeys,
      usage: isRecord(keysResult.usage) && isUsage(keysResult.usage) ? keysResult.usage : null,
    } satisfies DeveloperData;
  }, [databaseConnected]);

  const applyData = useCallback((data: DeveloperData) => {
    setApps(data.apps);
    setKeys(data.keys);
    setUsage(data.usage);
    setSelectedAppId((current) =>
      data.apps.some((app) => app.id === current) ? current : data.apps[0]?.id ?? "",
    );
    setIsReady(true);
  }, []);

  const refreshData = useCallback(async () => {
    applyData(await loadData());
  }, [applyData, loadData]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await loadData();
        if (active) applyData(data);
      } catch (error) {
        if (active) {
          setStatus(error instanceof Error ? error.message : "Developer data could not be loaded.");
          setIsReady(true);
        }
      }
    })();
    return () => { active = false; };
  }, [applyData, loadData]);

  async function registerApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsWorking(true);
    try {
      const response = await fetch("/api/developer/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: appName.trim() }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result) || !isDeveloperApp(result.app)) {
        throw new Error(readError(result, "The developer application could not be registered."));
      }
      const app = result.app;
      setAppName("");
      setApps((current) => [app, ...current]);
      setSelectedAppId(app.id);
      setStatus("Developer application registered.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The developer application could not be registered.");
    } finally {
      setIsWorking(false);
    }
  }

  async function createApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedApp) return;
    setStatus("");
    setIsWorking(true);
    try {
      const response = await fetch("/api/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: selectedApp.id, name: keyName.trim() }),
      });
      const result: unknown = await response.json();
      const key = isRecord(result) ? result.key : undefined;
      if (!response.ok || !isIssuedKey(key)) {
        throw new Error(readError(result, "The API key could not be created."));
      }
      const secret = key.secret;
      const issued: IssuedKey = { ...key, secret };
      setIssuedKey(issued);
      setTestKey(issued.secret);
      setKeyName("");
      setKeys((current) => [key, ...current]);
      try {
        await refreshData();
      } catch {
        setStatus("The key was created, but the list could not be refreshed. Reload the page to update it.");
        return;
      }
      setStatus("API key created. Copy the secret now; it will not be shown again.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The API key could not be created.");
    } finally {
      setIsWorking(false);
    }
  }

  async function revokeKey(key: DeveloperKey) {
    if (!window.confirm(`Revoke "${key.name}"? Applications using this key will stop working immediately.`)) return;
    setStatus("");
    setIsWorking(true);
    try {
      const response = await fetch("/api/developer/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: key.id }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(readError(result, "The API key could not be revoked."));
      setKeys((current) => current.map((item) =>
        item.id === key.id ? { ...item, revoked_at: new Date().toISOString() } : item,
      ));
      try {
        await refreshData();
      } catch {
        setStatus(`API key "${key.name}" was revoked, but the list could not be refreshed.`);
        return;
      }
      setStatus(`API key "${key.name}" was revoked.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The API key could not be revoked.");
    } finally {
      setIsWorking(false);
    }
  }

  async function copySecret() {
    if (!issuedKey) return;
    try {
      await navigator.clipboard.writeText(issuedKey.secret);
      setStatus("API key copied to clipboard.");
    } catch {
      setStatus("Clipboard access was denied. Select and copy the key manually.");
    }
  }

  async function testApi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setTestResult("");
    setIsTesting(true);
    try {
      const response = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "vornokia-prime",
          messages: [{ role: "user", content: testPrompt.trim() }],
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(readPublicApiError(result, "The API test failed."));
      const choice = isRecord(result) && Array.isArray(result.choices) ? result.choices[0] : null;
      const message = isRecord(choice) ? choice.message : null;
      if (!isRecord(message) || typeof message.content !== "string") {
        throw new Error("The API returned an unexpected completion.");
      }
      setTestResult(message.content);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The API test failed.");
    } finally {
      setIsTesting(false);
    }
  }

  if (!databaseConnected) {
    return (
      <section className="settings-page developer-page">
        <div className="page-heading">
          <div className="eyebrow"><span /> BUILD WITH VORNOKIA</div>
          <h1>Developer platform</h1>
          <p>Register applications, create scoped keys, and test the Vornokia API.</p>
        </div>
        <div className="settings-card developer-empty">
          <ShieldCheck size={22} />
          <h2>Connect a developer account</h2>
          <p>Configure Supabase authentication and apply the developer platform migration to manage applications and API keys.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="settings-page developer-page">
      <div className="page-heading">
        <div className="eyebrow"><span /> BUILD WITH VORNOKIA</div>
        <h1>Developer platform</h1>
        <p>Register applications, issue permission-scoped API keys, and test the Vornokia API.</p>
      </div>

      <div className="privacy-callout developer-safety-callout">
        <ShieldCheck size={18} />
        <div>
          <strong>Scoped access, not a master credential.</strong>
          <p>Keys currently grant only chat generation. Secrets are shown once, stored as SHA-256 hashes, and can be revoked at any time. Never put a key in browser code or a public repository.</p>
        </div>
      </div>

      <div className="developer-stat-grid">
        <article className="settings-card developer-stat">
          <span><Activity size={16} /> This month</span>
          <strong>{usage?.month_requests.toLocaleString() ?? "—"}</strong>
          <small>API requests · {usage?.monthly_limit_per_key.toLocaleString() ?? "10,000"} per key</small>
        </article>
        <article className="settings-card developer-stat">
          <span><KeyRound size={16} /> Active keys</span>
          <strong>{usage?.active_keys ?? activeKeys.length}</strong>
          <small>Up to five keys per app · ten active keys per account</small>
        </article>
        <article className="settings-card developer-stat">
          <span><Code2 size={16} /> Token usage</span>
          <strong>{((usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0)).toLocaleString()}</strong>
          <small>{usage?.input_tokens.toLocaleString() ?? 0} in · {usage?.output_tokens.toLocaleString() ?? 0} out</small>
        </article>
      </div>

      <div className="developer-toolbar">
        <label className="field-label">Application
          <select value={selectedApp?.id ?? ""} onChange={(event) => setSelectedAppId(event.target.value)} disabled={!apps.length || !isReady}>
            {apps.length
              ? apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)
              : <option value="">Register an application to begin</option>}
          </select>
        </label>
        <Link className="button button-secondary" href="/developers/docs"><Code2 size={14} /> API documentation</Link>
      </div>

      <div className="developer-layout">
        <form className="settings-card developer-form" onSubmit={(event) => void registerApp(event)}>
          <div className="settings-card-heading">
            <span className="settings-heading-icon"><Plus size={17} /></span>
            <div><h2>Register an application</h2><p>Create a developer app linked to your Vornokia account.</p></div>
          </div>
          <label className="field-label">Application name
            <input value={appName} onChange={(event) => setAppName(event.target.value)} maxLength={80} required placeholder="e.g. My assistant integration" disabled={!isReady || isWorking} />
          </label>
          <button className="button button-primary" type="submit" disabled={!isReady || isWorking || !appName.trim()}>
            {isWorking ? <LoaderCircle className="developer-spinner" size={14} /> : <Plus size={14} />} Register app
          </button>
        </form>

        <form className="settings-card developer-form" onSubmit={(event) => void createApiKey(event)}>
          <div className="settings-card-heading">
            <span className="settings-heading-icon"><KeyRound size={17} /></span>
            <div><h2>Create a scoped API key</h2><p>Keys can generate chat completions only.</p></div>
          </div>
          <label className="field-label">Key name
            <input value={keyName} onChange={(event) => setKeyName(event.target.value)} maxLength={80} required placeholder="e.g. Development server" disabled={!selectedApp || isWorking} />
          </label>
          <button className="button button-primary" type="submit" disabled={!selectedApp || !keyName.trim() || isWorking}>
            {isWorking ? <LoaderCircle className="developer-spinner" size={14} /> : <KeyRound size={14} />} Create API key
          </button>
        </form>
      </div>

      {issuedKey && (
        <div className="settings-card developer-secret-card">
          <div className="settings-card-heading">
            <span className="settings-heading-icon"><ShieldCheck size={17} /></span>
            <div><h2>Copy your new API key</h2><p>This secret is shown once and cannot be recovered after leaving this page.</p></div>
            <button className="icon-button developer-close" type="button" aria-label="Dismiss API key" onClick={() => setIssuedKey(null)}><X size={15} /></button>
          </div>
          <div className="developer-secret-row">
            <code>{issuedKey.secret}</code>
            <button className="button button-secondary" type="button" onClick={() => void copySecret()}><Copy size={14} /> Copy</button>
          </div>
        </div>
      )}

      <div className="developer-layout developer-workbench">
        <div className="settings-card developer-key-list">
          <div className="settings-card-heading">
            <span className="settings-heading-icon"><KeyRound size={17} /></span>
            <div><h2>Application keys</h2><p>{selectedApp ? `Keys for ${selectedApp.name}.` : "Register an application to create an API key."}</p></div>
          </div>
          {!isReady ? (
            <p className="developer-empty-copy"><LoaderCircle className="developer-spinner" size={15} /> Loading developer data…</p>
          ) : !selectedKeys.length ? (
            <p className="developer-empty-copy">No API keys yet. Create one when you are ready to connect an application.</p>
          ) : (
            <div className="developer-key-list-items">
              {selectedKeys.map((key) => (
                <article className="developer-key-item" key={key.id}>
                  <div className="developer-key-copy">
                    <strong>{key.name}</strong>
                    <code>{key.key_prefix}…</code>
                    <small>{key.scopes.join(", ")} · {key.per_minute_limit} requests/minute</small>
                    <small>{key.revoked_at ? `Revoked ${new Date(key.revoked_at).toLocaleDateString()}` : key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleString()}` : "Not used yet"}</small>
                  </div>
                  {key.revoked_at ? (
                    <span className="developer-revoked">Revoked</span>
                  ) : (
                    <button className="button button-danger-outline" type="button" disabled={isWorking} onClick={() => void revokeKey(key)}>Revoke</button>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <form className="settings-card developer-tester" onSubmit={(event) => void testApi(event)}>
          <div className="settings-card-heading">
            <span className="settings-heading-icon"><Send size={17} /></span>
            <div><h2>Test the API</h2><p>Run a real request through the configured server-side model gateway.</p></div>
          </div>
          <label className="field-label">API key
            <input type="password" autoComplete="off" value={testKey} onChange={(event) => setTestKey(event.target.value)} placeholder="vno_live_…" required />
          </label>
          <label className="field-label">Prompt
            <textarea value={testPrompt} onChange={(event) => setTestPrompt(event.target.value)} maxLength={4000} rows={4} required placeholder="Ask Vornokia Prime a question…" />
          </label>
          <button className="button button-primary" type="submit" disabled={!testKey.trim() || !testPrompt.trim() || isTesting}>
            {isTesting ? <LoaderCircle className="developer-spinner" size={14} /> : <Send size={14} />} Send test request
          </button>
          {testResult && <div className="developer-test-result"><div><Check size={14} /> API response</div><p>{testResult}</p></div>}
        </form>
      </div>

      {status && <p className="developer-status" role="status">{status}</p>}
      {!isReady && <p className="developer-status developer-loading"><LoaderCircle className="developer-spinner" size={14} /> Loading developer platform…</p>}
    </section>
  );
}

function readPublicApiError(value: unknown, fallback: string) {
  if (isRecord(value) && isRecord(value.error) && typeof value.error.message === "string") {
    return value.error.message;
  }
  return fallback;
}
