"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Clipboard,
  Compass,
  FileText,
  Lightbulb,
  Plus,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getMessagesSnapshot,
  getServerMessagesSnapshot,
  Message,
  saveMessages,
  subscribeToMessages,
} from "@/lib/conversation-store";
const suggestions = [
  { icon: Compass, title: "Plan my week", prompt: "Help me plan a focused, balanced week." },
  { icon: Lightbulb, title: "Explore an idea", prompt: "Help me think through a new idea I'm exploring." },
  { icon: FileText, title: "Write something", prompt: "Help me draft a clear, thoughtful project update." },
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createPreviewReply(prompt: string) {
  const subject = prompt.replace(/[.!?]+$/, "").trim();
  return `I can help you get started with that. Since this is a preview, I can't connect to an AI model yet—but here's a useful first step: write down what a good outcome looks like for “${subject},” then choose one small action you can take today.`;
}

export function ChatPanel({ initialPrompt = "" }: { initialPrompt?: string }) {
  const messages = useSyncExternalStore(
    subscribeToMessages,
    getMessagesSnapshot,
    getServerMessagesSnapshot,
  );
  const [input, setInput] = useState(initialPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  function addMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;
    const now = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const userMessage: Message = { id: createId(), role: "user", content: trimmed, time: now };
    setError("");
    try {
      saveMessages([...messages, userMessage]);
    } catch {
      setError("This conversation could not be saved in this browser.");
    }
    setInput("");
    setIsLoading(true);
    window.setTimeout(() => {
      const reply: Message = {
        id: createId(),
        role: "assistant",
        content: createPreviewReply(trimmed),
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      };
      try {
        saveMessages([...getMessagesSnapshot(), reply]);
      } catch {
        setError("This conversation could not be saved in this browser.");
      }
      setIsLoading(false);
    }, 850);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      addMessage(input);
    }
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

  function startNewChat() {
    setInput("");
    setError("");
    try {
      saveMessages([]);
    } catch {
      setError("The preview conversation could not be cleared from this browser.");
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <section className="chat-page">
      <div className="chat-heading">
        <div>
          <div className="eyebrow"><span /> VORNOKIA PRIME</div>
          <h1>Your thinking space.</h1>
          <p>Bring a question, a plan, or just a starting point.</p>
        </div>
        <button className="button button-secondary new-chat-button" type="button" onClick={startNewChat} disabled={isLoading}>
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
            <span className="model-label"><span /> Preview model</span>
            <button
              className="icon-button"
              type="button"
              aria-label="Scroll to latest message"
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
            >
              <ArrowDown size={17} />
            </button>
          </div>
        </div>

        <div className={`chat-transcript${isEmpty ? " chat-transcript-empty" : ""}`}>
          {isEmpty ? (
            <div className="chat-welcome">
              <div className="welcome-orb"><WandSparkles size={25} /></div>
              <div className="eyebrow"><span /> A LITTLE ROOM TO THINK</div>
              <h2>What’s on your mind?</h2>
              <p>Ask a question or choose a starting point. Your preview chat stays in this browser.</p>
              <div className="suggestion-grid">
                {suggestions.map(({ icon: Icon, title, prompt }) => (
                  <button className="suggestion-card" key={title} type="button" onClick={() => addMessage(prompt)}>
                    <span className="suggestion-icon"><Icon size={17} /></span>
                    <strong>{title}</strong>
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list" aria-live="polite">
              {messages.map((message) => (
                <article className={`message-row message-${message.role}`} key={message.id}>
                  {message.role === "assistant" && (
                    <span className="message-avatar"><Sparkles size={14} /></span>
                  )}
                  <div className="message-body">
                    <div className="message-meta">
                      <strong>{message.role === "assistant" ? "Prime · Preview" : "You"}</strong>
                      <time>{message.time}</time>
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
                <div className="message-row message-assistant" role="status" aria-label="Preparing preview reply">
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
              disabled={isLoading}
            />
            <div className="composer-bottom">
              <span><span className="composer-secure-dot" /> Preview mode · No model connected</span>
              <div className="composer-actions">
                <span className="composer-hint">Shift + Enter for a new line</span>
                <button
                  className="send-button"
                  type="submit"
                  aria-label="Send message"
                  disabled={!input.trim() || isLoading}
                >
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>
          </form>
          <p className="chat-disclaimer">Preview replies are simulated. Connect a model in Phase 2 to get live answers.</p>
        </div>
      </div>
    </section>
  );
}
