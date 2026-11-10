import { Eye, FileText, Mic, ShieldCheck } from "lucide-react";
import { ChatPanel } from "@/components/chat-panel";
import { LiveChatPanel } from "@/components/live-chat-panel";
import { isModelGatewayConfigured } from "@/lib/intelligence/model-gateway";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const capabilities = [
  {
    icon: Mic,
    title: "Voice conversations",
    description: "Speak naturally, hear replies, and keep voice mode under your control.",
  },
  {
    icon: Eye,
    title: "Image understanding",
    description: "Choose images or capture one with your camera to add visual context.",
  },
  {
    icon: FileText,
    title: "Document analysis",
    description: "Attach supported documents and ask Vornokia to help you understand them.",
  },
];

export default function VoiceVisionPage() {
  const accountConnected = isSupabaseConfigured();

  return (
    <div className="voice-vision-page">
      <header className="page-heading voice-vision-heading">
        <div className="eyebrow"><span /> MULTIMODAL WORKSPACE</div>
        <h1>Voice &amp; Vision</h1>
        <p>Talk through an idea, share what you see, or bring a document into the conversation.</p>
      </header>

      <div className="voice-vision-capabilities">
        {capabilities.map(({ icon: Icon, title, description }) => (
          <article className="voice-vision-capability" key={title}>
            <span className="voice-vision-capability-icon"><Icon size={19} aria-hidden="true" /></span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </div>

      <div className="voice-vision-privacy" role="note">
        <ShieldCheck size={17} aria-hidden="true" />
        <p>Microphone and camera access begin only when you choose their controls. Review files before attaching them.</p>
      </div>

      {accountConnected
        ? <LiveChatPanel aiConfigured={isModelGatewayConfigured()} />
        : (
          <div className="voice-vision-preview">
            <p>Connect an account and configure the AI gateway to use voice, image, and document tools. Text chat is available in preview mode below.</p>
            <ChatPanel />
          </div>
        )}
    </div>
  );
}
