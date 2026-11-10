"use client";

import { ArrowRight, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getMessagesSnapshot,
  getServerMessagesSnapshot,
  subscribeToMessages,
} from "@/lib/conversation-store";

type RecentConversationData = { title: string; time: string } | null;

export function RecentConversation({ databaseConnected = false }: { databaseConnected?: boolean }) {
  const previewMessages = useSyncExternalStore(
    subscribeToMessages,
    getMessagesSnapshot,
    getServerMessagesSnapshot,
  );
  const [databaseConversation, setDatabaseConversation] = useState<RecentConversationData>(null);
  const [databaseReady, setDatabaseReady] = useState(!databaseConnected);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!databaseConnected) return;
    let active = true;
    const loadLatest = async () => {
      try {
        const response = await fetch("/api/chat", { cache: "no-store" });
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || !Array.isArray(result.messages)) {
          throw new Error(
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "Recent conversation could not be loaded.",
          );
        }
        if (!active) return;
        const firstUserMessage = result.messages.find(
          (message) => isRecord(message) && message.role === "user" && typeof message.content === "string",
        );
        const latestMessage = result.messages.at(-1);
        if (
          isRecord(firstUserMessage) &&
          isRecord(latestMessage) &&
          typeof firstUserMessage.content === "string" &&
          typeof latestMessage.time === "string"
        ) {
          setDatabaseConversation({
            title: firstUserMessage.content,
            time: formatTime(latestMessage.time),
          });
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : "Recent conversation could not be loaded.",
          );
        }
      } finally {
        if (active) setDatabaseReady(true);
      }
    };
    void loadLatest();
    return () => {
      active = false;
    };
  }, [databaseConnected]);

  if (databaseConnected) {
    if (!databaseReady) {
      return <div className="empty-conversation"><span className="typing-indicator"><i /><i /><i /></span><div><strong>Loading your history</strong><p>Checking your account conversations.</p></div></div>;
    }
    if (loadError) {
      return <div className="empty-conversation"><span className="empty-icon"><MessageSquareText size={18} /></span><div><strong>History unavailable</strong><p>{loadError}</p></div></div>;
    }
    if (!databaseConversation) {
      return (
        <div className="empty-conversation">
          <span className="empty-icon"><MessageSquareText size={18} /></span>
          <div><strong>A fresh page</strong><p>Your first saved conversation will appear here.</p></div>
          <Link className="subtle-link" href="/app/chat">Start <ArrowRight size={14} /></Link>
        </div>
      );
    }

    return (
      <Link className="empty-conversation recent-conversation" href="/app/chat">
        <span className="empty-icon"><MessageSquareText size={18} /></span>
        <div><strong>{truncate(databaseConversation.title)}</strong><p>Last message at {databaseConversation.time} · Saved to your account</p></div>
        <span className="subtle-link">Continue <ArrowRight size={14} /></span>
      </Link>
    );
  }

  const messages = previewMessages;
  const firstUserMessage = messages.find((message) => message.role === "user");
  const latestMessage = messages.at(-1);

  if (!firstUserMessage || !latestMessage) {
    return (
      <div className="empty-conversation">
        <span className="empty-icon"><MessageSquareText size={18} /></span>
        <div><strong>A fresh page</strong><p>Your preview workspace is ready for its first conversation.</p></div>
        <Link className="subtle-link" href="/app/chat">Start <ArrowRight size={14} /></Link>
      </div>
    );
  }

  const title = truncate(firstUserMessage.content);

  return (
    <Link className="empty-conversation recent-conversation" href="/app/chat">
      <span className="empty-icon"><MessageSquareText size={18} /></span>
      <div><strong>{title}</strong><p>Last message at {latestMessage.time} · Stored in this browser</p></div>
      <span className="subtle-link">Continue <ArrowRight size={14} /></span>
    </Link>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function truncate(value: string) {
  return value.length > 52 ? `${value.slice(0, 49)}…` : value;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
