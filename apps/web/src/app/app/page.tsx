import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  MessageSquareText,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { RecentConversation } from "@/components/recent-conversation";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const promptCards = [
  {
    icon: Sparkles,
    title: "Think it through",
    description: "Untangle a question and find a clear next step.",
  },
  {
    icon: Clock3,
    title: "Make a plan",
    description: "Turn a busy week into a focused, realistic plan.",
  },
  {
    icon: Zap,
    title: "Get unstuck",
    description: "Find a fresh way into the thing you’re working on.",
  },
];

export default function DashboardPage() {
  return (
    <div className="dashboard-page">
      <section className="dashboard-welcome">
        <div>
          <div className="eyebrow"><span /> YOUR VORNOKIA WORKSPACE</div>
          <h1>Good evening, Vornokia user<span>.</span></h1>
          <p>One clear thought can change the shape of your day.</p>
        </div>
        <Link className="button button-primary dashboard-start-button" href="/app/chat">
          <Sparkles size={16} /> Start a conversation <ArrowRight size={16} />
        </Link>
      </section>

      <section className="dashboard-hero-card">
        <div className="dashboard-orbit orbit-one" />
        <div className="dashboard-orbit orbit-two" />
        <div className="dashboard-hero-copy">
          <div className="eyebrow eyebrow-light"><span /> YOUR INTELLIGENCE, IN SYNC</div>
          <h2>Make space for<br />better thinking.</h2>
          <p>Bring your ideas together. Get clarity, find momentum, and move forward with intention.</p>
          <Link className="hero-link" href="/app/chat">Open your chat <ArrowUpRight size={16} /></Link>
        </div>
        <div className="hero-constellation" aria-hidden="true">
          <span className="constellation-ring ring-a" />
          <span className="constellation-ring ring-b" />
          <span className="constellation-core"><Sparkles size={27} /></span>
          <span className="constellation-node node-a" />
          <span className="constellation-node node-b" />
          <span className="constellation-node node-c" />
          <span className="constellation-node node-d" />
        </div>
        <span className="hero-card-index">01 — PRIME</span>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h2>Where would you like to begin?</h2>
            <p>A few good starting points for today.</p>
          </div>
          <Link className="subtle-link" href="/app/chat">Explore chat <ArrowRight size={15} /></Link>
        </div>
        <div className="prompt-grid">
          {promptCards.map(({ icon: Icon, title, description }) => (
            <Link
              className="prompt-card"
              href="/app/chat"
              key={title}
            >
              <span className="prompt-icon"><Icon size={18} /></span>
              <span className="prompt-card-arrow"><ArrowUpRight size={16} /></span>
              <strong>{title}</strong>
              <span className="prompt-card-description">{description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-lower-grid">
        <div className="recent-panel">
          <div className="section-heading section-heading-compact">
            <div><h2>Pick up where you left off</h2><p>Your conversations will live here.</p></div>
            <MessageSquareText size={18} />
          </div>
          <RecentConversation databaseConnected={isSupabaseConfigured()} />
        </div>
        <div className="dashboard-note">
          <div className="note-icon"><Sparkles size={17} /></div>
          <span className="eyebrow">A NOTE ON THIS PREVIEW</span>
          <p>Your chats are stored only in this browser. Sign-in, cloud sync, and live AI will arrive in the next build phase.</p>
          <Link href="/app/settings">Explore your settings <ArrowRight size={14} /></Link>
        </div>
      </section>
    </div>
  );
}
