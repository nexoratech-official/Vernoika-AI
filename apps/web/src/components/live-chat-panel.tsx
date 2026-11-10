"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Clipboard,
  Plus,
  Sparkles,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/conversation-store";

const starters = [
  "Help me plan a focused, balanced week.",
  "Help me think through a new idea I'm exploring.",
  "Help me draft a clear, thoughtful project update.",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMessage(value: unknown): value is Message {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string" &&
    typeof value.time === "string"
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function LiveChatPanel({ aiConfigured }: { aiConfigured: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const loadLatestConversation = async () => {
      try {
        const response = await fetch("/api/chat", { cache: "no-store" });
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || !Array.isArray(result.messages)) {
          const message =
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "Conversation history could not be loaded.";
          throw new Error(message);
        }
        if (!active) return;
        setMessages(result.messages.filter(isMessage));
        setConversationId(typeof result.conversationId === "string" ? result.conversationId : null);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Conversation history could not be loaded.",
          );
        }
      } finally {
        if (active) setIsReady(true);
      }
    };
    void loadLatestConversation();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  async function sendMessage(content: string) {
    const message = content.trim();
    if (!message || isLoading || !aiConfigured || !isReady) return;
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      time: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setIsLoading(true);
    let assistantMessage: Message | null = null;
    let receivedDone = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
      });

      if (!response.ok) {
        let responseError = "The message could not be sent.";
        try {
          const result: unknown = await response.json();
          if (isRecord(result) && typeof result.error === "string") responseError = result.error;
        } catch {
          responseError = "The message could not be sent.";
        }
        if (response.headers.get("X-Message-Saved") !== "true") {
          setMessages((current) => current.filter((item) => item.id !== userMessage.id));
        }
        throw new Error(responseError);
      }

      const responseId = response.headers.get("X-Conversation-Id");
      if (responseId) setConversationId(responseId);
      if (!response.body) throw new Error("The response stream is unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processEvent = (block: string) => {
        const lines = block.split(/\r?\n/);
        const eventName = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
        const data = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!eventName || !data) return;

        let payload: unknown;
        try {
          payload = JSON.parse(data);
        } catch {
          throw new Error("The response stream contained invalid data.");
        }
        if (!isRecord(payload)) return;
        if (eventName === "error") {
          throw new Error(
            typeof payload.error === "string" ? payload.error : "The response stream failed.",
          );
        }
        if (eventName === "done") {
          receivedDone = true;
          return;
        }
        if (eventName === "meta" && typeof payload.conversationId === "string") {
          setConversationId(payload.conversationId);
        }
        if (eventName === "token" && typeof payload.content === "string") {
          assistantMessage ??= {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "",
            time: new Date().toISOString(),
          };
          assistantMessage = {
            ...assistantMessage,
            content: assistantMessage.content + payload.content,
          };
          const nextMessage = assistantMessage;
          setMessages((current) => {
            const exists = current.some((item) => item.id === nextMessage.id);
            return exists
              ? current.map((item) => (item.id === nextMessage.id ? nextMessage : item))
              : [...current, nextMessage];
          });
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        events.forEach(processEvent);
      }
      buffer += decoder.decode();
      if (buffer.trim()) processEvent(buffer);
      if (!receivedDone) throw new Error("The response stream ended unexpectedly.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "The message could not be sent.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  function startNewChat() {
    setMessages([]);
    setConversationId(null);
    setInput("");
    setError("");
  }

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(""), 1500);
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  }

  const isEmpty = isReady && messages.length === 0;

  return (
    <section className="chat-page">
      <div className="chat-heading">
        <div>
          <div className="eyebrow"><span /> VORNOKIA PRIME</div>
          <h1>Your thinking space.</h1>
          <p>Bring a question, a plan, or just a starting point.</p>
        </div>
        <button className="button button-secondary new-chat-button" type="button" onClick={startNewChat} disabled={!isReady || isLoading}>
          <Plus size={16} /> New chat
        </button>
      </div>

      <div className="chat-frame">
        <div className="chat-toolbar">
          <div className="chat-agent">
            <span className="agent-orb"><Sparkles size={16} /></span>
            <span><strong>Prime</strong><small>General assistant</small></span>
          </div>
          <div className="chat-toolbar-right">
            <span className={`model-label${aiConfigured ? "" : " model-label-not-ready"}`}>
              <span />{aiConfigured ? "Configured model" : "Model setup needed"}
            </span>
            <button className="icon-button" type="button" aria-label="Scroll to latest message" onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}>
              <ArrowDown size={17} />
            </button>
          </div>
        </div>

        <div className={`chat-transcript${isEmpty ? " chat-transcript-empty" : ""}`}>
          {isEmpty ? (
            <div className="chat-welcome">
              <div className="welcome-orb"><Sparkles size={25} /></div>
              <div className="eyebrow"><span /> A LITTLE ROOM TO THINK</div>
              <h2>What’s on your mind?</h2>
              <p>Your conversations are saved to your Vornokia account.</p>
              <div className="suggestion-grid">
                {starters.map((prompt) => (
                  <button className="suggestion-card" key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={!aiConfigured}>
                    <span className="suggestion-icon"><Sparkles size={17} /></span>
                    <strong>{prompt.split(" ").slice(0, 3).join(" ")}</strong>
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list" aria-live="polite">
              {messages.map((message) => (
                <article className={`message-row message-${message.role}`} key={message.id}>
                  {message.role === "assistant" && <span className="message-avatar"><Sparkles size={14} /></span>}
                  <div className="message-body">
                    <div className="message-meta">
                      <strong>{message.role === "assistant" ? "Prime" : "You"}</strong>
                      <time>{formatTime(message.time)}</time>
                    </div>
                    <p>{message.content}</p>
                    {message.role === "assistant" && (
                      <button className="message-copy" type="button" onClick={() => void copyMessage(message)}>
                        {copiedId === message.id ? <Check size={14} /> : <Clipboard size={14} />}
                        {copiedId === message.id ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {isLoading && (
                <div className="message-row message-assistant" role="status" aria-label="Preparing response">
                  <span className="message-avatar"><Sparkles size={14} /></span>
                  <div className="typing-indicator"><i /><i /><i /></div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          {error && <p className="inline-error" role="alert">{error}</p>}
          {!aiConfigured && (
            <p className="configuration-notice" role="status">
              Set AI_BASE_URL, AI_API_KEY, and AI_MODEL on the server to enable live chat.
            </p>
          )}
          <form className="chat-composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="chat-input">Message Vornokia</label>
            <textarea
              id="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Vornokia..."
              rows={2}
              maxLength={4000}
              disabled={!isReady || !aiConfigured || isLoading}
            />
            <div className="composer-bottom">
              <span><span className="composer-secure-dot composer-ready-dot" /> Account chat · Server-side model gateway</span>
              <div className="composer-actions">
                <span className="composer-hint">Shift + Enter for a new line</span>
                <button className="send-button" type="submit" aria-label="Send message" disabled={!input.trim() || !isReady || !aiConfigured || isLoading}>
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>
          </form>
          <p className="chat-disclaimer">Your messages are sent to the configured AI provider and stored with your account.</p>
        </div>
      </div>
    </section>
  );
}
