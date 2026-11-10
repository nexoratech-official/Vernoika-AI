"use client";

import {
  ArrowDown,
  Check,
  Camera,
  Clipboard,
  FileUp,
  FileText,
  ImagePlus,
  Mic,
  Plus,
  Send,
  Save,
  Square,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Image from "next/image";
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Message } from "@/lib/conversation-store";

type ImageAttachment = { id: string; name: string; dataUrl: string };
type DocumentAttachment = { id: string; name: string; text: string };

type RecognitionResult = {
  length: number;
  [index: number]: { transcript: string };
};

type RecognitionEvent = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: RecognitionResult;
  };
};

type RecognitionErrorEvent = Event & { error?: string };

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

const maxImageFileSize = 8 * 1024 * 1024;
const maxImageDataUrlLength = 1_100_000;
const maxDocumentFileSize = 3 * 1024 * 1024;
const maxDocumentTextLength = 16_000;
const maxCombinedDocumentTextLength = 24_000;
const supportedDocuments = new Set([".txt", ".md", ".csv", ".json", ".pdf", ".docx"]);

function subscribeToBrowserSupport() {
  return () => {};
}

function getSpeechRecognitionSupport() {
  return typeof window !== "undefined" && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

function getDesktopSupport() {
  return typeof window !== "undefined" && isTauri();
}

const starters = [
  "Help me plan a focused, balanced week.",
  "Help me think through a new idea I'm exploring.",
  "Help me draft a clear, thoughtful project update.",
];

function extensionOf(name: string) {
  return name.slice(name.lastIndexOf(".")).toLocaleLowerCase();
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The selected file could not be encoded."));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

async function prepareImage(file: File): Promise<ImageAttachment> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > maxImageFileSize) throw new Error("Each image must be smaller than 8 MB.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.src = objectUrl;
    await image.decode();
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 1600 / longestSide);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 780_000) {
        const dataUrl = await readAsDataUrl(blob);
        if (dataUrl.length > maxImageDataUrlLength) continue;
        return { id: crypto.randomUUID(), name: file.name, dataUrl };
      }
    }
    throw new Error("This image is too large to attach. Choose a smaller image.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function extractDocumentText(file: File): Promise<DocumentAttachment> {
  if (file.size > maxDocumentFileSize) throw new Error("Each document must be smaller than 3 MB.");
  const extension = extensionOf(file.name);
  if (!supportedDocuments.has(extension)) {
    throw new Error("Supported documents: PDF, DOCX, TXT, Markdown, CSV, or JSON.");
  }

  let text: string;
  if (extension === ".pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await loadingTask.promise;
    if (pdf.numPages > 30) {
      await loadingTask.destroy();
      throw new Error("PDFs are limited to 30 pages.");
    }
    const pages: string[] = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.flatMap((item) => "str" in item ? [item.str] : []).join(" "));
        if (pages.join("\n").length > maxDocumentTextLength) break;
      }
    } finally {
      await loadingTask.destroy();
    }
    text = pages.join("\n");
  } else if (extension === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else {
    text = await file.text();
  }

  const trimmedText = text.replace(/\u0000/g, "").trim().slice(0, maxDocumentTextLength);
  if (!trimmedText) throw new Error(`No readable text was found in "${file.name}".`);
  return { id: crypto.randomUUID(), name: file.name, text: trimmedText };
}

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
  const [desktopNotice, setDesktopNotice] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [documents, setDocuments] = useState<DocumentAttachment[]>([]);
  const [isProcessingAttachment, setIsProcessingAttachment] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRecognitionAvailable = useSyncExternalStore(
    subscribeToBrowserSupport,
    getSpeechRecognitionSupport,
    () => false,
  );
  const desktopAvailable = useSyncExternalStore(
    subscribeToBrowserSupport,
    getDesktopSupport,
    () => false,
  );
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cameraVideoRef.current || !cameraStream) return;
    cameraVideoRef.current.srcObject = cameraStream;
    void cameraVideoRef.current.play().catch(() => {
      setError("Camera preview could not start. Check camera permissions and try again.");
    });
  }, [cameraStream]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    cameraStream?.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

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

  function speakText(content: string) {
    if (!("speechSynthesis" in window)) {
      setError("Text-to-speech is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      setError("Speech playback could not start in this browser.");
    };
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }

  function startListening() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Speech recognition is not supported in this browser. You can still type a message.");
      return;
    }
    setError("");
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    const transcriptBase = input.trim();
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) =>
        event.results[index][0]?.transcript ?? "",
      ).join(" ").trim();
      if (transcript) setInput([transcriptBase, transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = (event) => {
      const message = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone permission was denied. Allow microphone access in your browser settings to use speech input."
        : event.error === "no-speech"
          ? "No speech was detected. Try again when you are ready."
          : `Speech recognition failed${event.error ? ` (${event.error})` : ""}.`;
      setError(message);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setError("The microphone could not be started. Check browser permissions and try again.");
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  async function processImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (images.length + files.length > 2) {
      setError("Attach up to two images per message.");
      return;
    }
    setError("");
    setIsProcessingAttachment(true);
    try {
      const processed = await Promise.all(files.map(prepareImage));
      setImages((current) => [...current, ...processed].slice(0, 2));
    } catch (attachmentError) {
      setError(attachmentError instanceof Error ? attachmentError.message : "The image could not be prepared.");
    } finally {
      setIsProcessingAttachment(false);
    }
  }

  async function processDocuments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (documents.length + files.length > 2) {
      setError("Attach up to two documents per message.");
      return;
    }
    setError("");
    setIsProcessingAttachment(true);
    try {
      const processed = await Promise.all(files.map(extractDocumentText));
      const combinedLength = [...documents, ...processed].reduce((total, file) => total + file.text.length, 0);
      if (combinedLength > maxCombinedDocumentTextLength) {
        throw new Error("The combined extracted text of attached documents must be under 24,000 characters.");
      }
      setDocuments((current) => [...current, ...processed].slice(0, 2));
    } catch (attachmentError) {
      setError(attachmentError instanceof Error ? attachmentError.message : "The document could not be read.");
    } finally {
      setIsProcessingAttachment(false);
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not supported in this browser.");
      return;
    }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      setCameraStream(stream);
      setCameraOpen(true);
    } catch {
      setError("Camera permission was denied or no camera is available. You can upload an image instead.");
    }
  }

  function stopCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraOpen(false);
  }

  async function captureCameraImage() {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("The camera is not ready yet. Wait for the preview and try again.");
      return;
    }
    if (images.length >= 2) {
      setError("Attach up to two images per message.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Image capture is unavailable in this browser.");
      return;
    }
    context.drawImage(video, 0, 0);
    const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!image) {
      setError("The camera image could not be captured.");
      return;
    }
    const capturedFile = new File([image], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    setIsProcessingAttachment(true);
    try {
      const prepared = await prepareImage(capturedFile);
      setImages((current) => [...current, prepared].slice(0, 2));
      stopCamera();
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "The camera image could not be prepared.");
    } finally {
      setIsProcessingAttachment(false);
    }
  }

  async function sendMessage(content: string) {
    const message = content.trim();
    const submittedImages = images;
    const submittedDocuments = documents;
    if ((!message && !submittedImages.length && !submittedDocuments.length) || isLoading || !aiConfigured || !isReady) return;
    const requestMessage = message || `Please analyze the attached ${submittedImages.length ? "image" : "document"}${submittedImages.length + submittedDocuments.length > 1 ? "s" : ""}.`;
    const displayMessage = [
      requestMessage,
      ...submittedImages.map((image) => `[Image: ${image.name}]`),
      ...submittedDocuments.map((file) => `[Document: ${file.name}]`),
    ].join("\n\n");
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: displayMessage,
      time: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setIsLoading(true);
    let assistantMessage: Message | null = null;
    let receivedDone = false;
    let messageSaved = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: requestMessage,
          conversationId,
          images: submittedImages.map(({ name, dataUrl }) => ({ name, dataUrl })),
          documents: submittedDocuments.map(({ name, text }) => ({ name, text })),
        }),
      });

      if (!response.ok) {
        let responseError = "The message could not be sent.";
        try {
          const result: unknown = await response.json();
          if (isRecord(result) && typeof result.error === "string") responseError = result.error;
        } catch {
          responseError = "The message could not be sent.";
        }
        messageSaved = response.headers.get("X-Message-Saved") === "true";
        if (!messageSaved) {
          setMessages((current) => current.filter((item) => item.id !== userMessage.id));
        }
        throw new Error(responseError);
      }

      messageSaved = true;
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
          setImages([]);
          setDocuments([]);
          if (voiceMode && assistantMessage?.content) speakText(assistantMessage.content);
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
      if (!messageSaved) setInput((current) => current || message);
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
    setImages([]);
    setDocuments([]);
    stopSpeaking();
    stopListening();
    stopCamera();
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

  async function attachDesktopTextFile() {
    if (documents.length >= 2) {
      setError("Attach no more than two documents to one message.");
      return;
    }
    setError("");
    setDesktopNotice("");
    try {
      const file = await invoke<{ name: string; text: string } | null>("read_selected_text_file");
      if (!file) return;
      if (file.text.length > maxDocumentTextLength) {
        throw new Error("The selected text exceeds the 16,000-character attachment limit.");
      }
      setDocuments((current) => [...current, {
        id: crypto.randomUUID(),
        name: file.name,
        text: file.text,
      }].slice(0, 2));
      setDesktopNotice(`${file.name} is attached. It will be sent only if you press Send.`);
    } catch (fileError) {
      setError(typeof fileError === "string" ? fileError : fileError instanceof Error ? fileError.message : "The selected file could not be attached.");
    }
  }

  async function saveAssistantMessage(message: Message) {
    setError("");
    setDesktopNotice("");
    try {
      const savedName = await invoke<string | null>("save_new_text_file", { content: message.content });
      if (savedName) setDesktopNotice(`Saved new file: ${savedName}.`);
    } catch (saveError) {
      setError(typeof saveError === "string" ? saveError : saveError instanceof Error ? saveError.message : "The new file could not be saved.");
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
            {isSpeaking && (
              <button className="icon-button" type="button" aria-label="Stop speech playback" onClick={stopSpeaking}>
                <VolumeX size={17} />
              </button>
            )}
            <button className="icon-button" type="button" aria-label="Scroll to latest message" onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}>
              <ArrowDown size={17} />
            </button>
          </div>
        </div>

        {cameraOpen && (
          <div className="camera-capture-panel">
            <video ref={cameraVideoRef} muted playsInline aria-label="Camera preview" />
            <div className="camera-capture-actions">
              <span>Camera is on only while this preview is open.</span>
              <button className="button button-primary" type="button" onClick={() => void captureCameraImage()} disabled={isProcessingAttachment}>
                <Camera size={14} /> Capture image
              </button>
              <button className="button button-secondary" type="button" onClick={stopCamera}>
                <X size={14} /> Stop camera
              </button>
            </div>
          </div>
        )}

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
                      <div className="message-actions">
                        <button className="message-copy" type="button" onClick={() => void copyMessage(message)}>
                          {copiedId === message.id ? <Check size={14} /> : <Clipboard size={14} />}
                          {copiedId === message.id ? "Copied" : "Copy"}
                        </button>
                        <button className="message-copy" type="button" aria-label={`Read aloud message from Prime`} onClick={() => speakText(message.content)}>
                          <Volume2 size={14} /> Read aloud
                        </button>
                        {desktopAvailable && (
                          <button className="message-copy" type="button" onClick={() => void saveAssistantMessage(message)}>
                            <Save size={14} /> Save new file
                          </button>
                        )}
                      </div>
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
          {desktopNotice && <p className="settings-delete-status" role="status">{desktopNotice}</p>}
          {!aiConfigured && (
            <p className="configuration-notice" role="status">
              Set AI_BASE_URL, AI_API_KEY, and AI_MODEL on the server to enable live chat.
            </p>
          )}
          <form className="chat-composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="chat-input">Message Vornokia</label>
            {images.length > 0 && (
              <div className="attachment-preview-list" aria-label="Image attachments">
                {images.map((image) => (
                  <div className="image-attachment-preview" key={image.id}>
                    <Image src={image.dataUrl} alt={image.name} width={48} height={48} unoptimized />
                    <span title={image.name}>{image.name}</span>
                    <button className="icon-button" type="button" aria-label={`Remove ${image.name}`} onClick={() => setImages((current) => current.filter((item) => item.id !== image.id))}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {documents.length > 0 && (
              <div className="document-attachment-list" aria-label="Document attachments">
                {documents.map((document) => (
                  <div className="document-attachment-chip" key={document.id}>
                    <FileUp size={14} />
                    <span title={document.name}>{document.name}</span>
                    <button className="icon-button" type="button" aria-label={`Remove ${document.name}`} onClick={() => setDocuments((current) => current.filter((item) => item.id !== document.id))}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="multimodal-controls">
              <input ref={imageInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void processImages(event)} />
              <input ref={documentInputRef} className="sr-only" type="file" accept=".pdf,.docx,.txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json" multiple onChange={(event) => void processDocuments(event)} />
              <button className="button button-secondary media-control-button" type="button" onClick={() => imageInputRef.current?.click()} disabled={!aiConfigured || isProcessingAttachment || isLoading || images.length >= 2} aria-label="Attach images">
                <ImagePlus size={14} /> Image
              </button>
              <button className="button button-secondary media-control-button" type="button" onClick={() => documentInputRef.current?.click()} disabled={!aiConfigured || isProcessingAttachment || isLoading || documents.length >= 2} aria-label="Attach documents">
                <FileUp size={14} /> Document
              </button>
              {desktopAvailable && (
                <button className="button button-secondary media-control-button" type="button" onClick={() => void attachDesktopTextFile()} disabled={!aiConfigured || isProcessingAttachment || isLoading || documents.length >= 2} aria-label="Attach a local text file">
                  <FileText size={14} /> Local file
                </button>
              )}
              <button className={`button button-secondary media-control-button${cameraOpen ? " media-control-active" : ""}`} type="button" onClick={() => cameraOpen ? stopCamera() : void startCamera()} disabled={!aiConfigured || isProcessingAttachment || isLoading || images.length >= 2} aria-pressed={cameraOpen} aria-label={cameraOpen ? "Stop camera" : "Open camera"}>
                <Camera size={14} /> {cameraOpen ? "Camera on" : "Camera"}
              </button>
              <button className={`button button-secondary media-control-button${voiceMode ? " media-control-active" : ""}`} type="button" role="switch" aria-checked={voiceMode} aria-label="Voice conversation mode" onClick={() => setVoiceMode((value) => !value)}>
                <Volume2 size={14} /> Voice {voiceMode ? "on" : "off"}
              </button>
              {speechRecognitionAvailable && (
                <button className={`button button-secondary media-control-button${isListening ? " media-control-active" : ""}`} type="button" onClick={() => isListening ? stopListening() : startListening()} disabled={isLoading || !aiConfigured} aria-pressed={isListening} aria-label={isListening ? "Stop microphone" : "Start microphone"}>
                  {isListening ? <Square size={13} /> : <Mic size={14} />} {isListening ? "Stop mic" : "Speak"}
                </button>
              )}
            </div>
            {isProcessingAttachment && <p className="configuration-notice" role="status">Preparing your attachment locally…</p>}
            {!speechRecognitionAvailable && <p className="configuration-notice">Speech input is not supported by this browser. You can still type and use read-aloud.</p>}
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
                <button className="send-button" type="submit" aria-label="Send message" disabled={(!input.trim() && !images.length && !documents.length) || !isReady || !aiConfigured || isLoading || isProcessingAttachment}>
                  <Send size={16} />
                </button>
              </div>
            </div>
          </form>
          <p className="chat-disclaimer">Messages and extracted document text are sent to your configured AI provider. Uploaded images and documents are used for this request only; files and contents are not retained, but attachment names appear in your saved chat. Images require a vision-capable model. Browser speech recognition may send audio to the browser’s speech provider; text-to-speech plays in your browser.</p>
        </div>
      </div>
    </section>
  );
}
