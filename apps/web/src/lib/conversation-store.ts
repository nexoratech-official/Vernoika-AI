export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
};

const storageKey = "vornokia-preview-conversation";
const emptyMessages: Message[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedMessages = emptyMessages;
let hasUnsavedMessages = false;

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    typeof message.time === "string"
  );
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function getMessagesSnapshot(): Message[] {
  if (typeof window === "undefined") return emptyMessages;
  if (hasUnsavedMessages) return cachedMessages;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return cachedMessages;
  }

  if (raw === cachedRaw) return cachedMessages;
  cachedRaw = raw;

  if (!raw) {
    cachedMessages = emptyMessages;
    return cachedMessages;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    cachedMessages = Array.isArray(parsed) && parsed.every(isMessage) ? parsed : emptyMessages;
  } catch {
    cachedMessages = emptyMessages;
  }
  return cachedMessages;
}

export function getServerMessagesSnapshot() {
  return emptyMessages;
}

export function subscribeToMessages(listener: () => void) {
  listeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      cachedRaw = null;
      hasUnsavedMessages = false;
      notify();
    }
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function saveMessages(messages: Message[]) {
  const serialized = JSON.stringify(messages);
  cachedMessages = messages;

  try {
    window.localStorage.setItem(storageKey, serialized);
    cachedRaw = serialized;
    hasUnsavedMessages = false;
  } catch (error) {
    hasUnsavedMessages = true;
    notify();
    throw error;
  }

  notify();
}
