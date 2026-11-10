"use client";

import { SunMoon } from "lucide-react";
import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";
const storageKey = "vornokia.theme";
const changeEvent = "vornokia-theme-change";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function setDocumentTheme(preference: ThemePreference) {
  const resolved =
    preference === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : preference;
  document.documentElement.dataset.theme = resolved;
}

function applyTheme(preference: ThemePreference) {
  setDocumentTheme(preference);
  try {
    localStorage.setItem(storageKey, preference);
  } catch {
    throw new Error("The theme changed, but this browser could not save the preference.");
  }
  window.dispatchEvent(new Event(changeEvent));
}

export function ThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const syncPreference = () => {
      let storedPreference: ThemePreference = "system";
      try {
        const stored = localStorage.getItem(storageKey);
        storedPreference = isThemePreference(stored) ? stored : "system";
      } catch {
        setStatus("Theme preference storage is unavailable; using your system setting.");
      }
      setPreference(storedPreference);
      setDocumentTheme(storedPreference);
    };
    syncPreference();
    window.addEventListener(changeEvent, syncPreference);
    window.addEventListener("storage", syncPreference);
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      if (preference === "system") setDocumentTheme("system");
    };
    colorScheme.addEventListener("change", syncSystemTheme);
    return () => {
      window.removeEventListener(changeEvent, syncPreference);
      window.removeEventListener("storage", syncPreference);
      colorScheme.removeEventListener("change", syncSystemTheme);
    };
  }, [preference]);

  function changePreference(value: string) {
    if (!isThemePreference(value)) return;
    setStatus("");
    try {
      applyTheme(value);
      setPreference(value);
    } catch (error) {
      setPreference(value);
      setStatus(error instanceof Error ? error.message : "The theme preference could not be saved.");
    }
  }

  return (
    <label className="theme-control">
      <SunMoon size={16} aria-hidden="true" />
      <span className="sr-only">Color theme</span>
      <select aria-label="Color theme" value={preference} onChange={(event) => changePreference(event.target.value)}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      {status && <span className="sr-only" role="status">{status}</span>}
    </label>
  );
}
