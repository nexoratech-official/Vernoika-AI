import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Command,
  LockKeyhole,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { ThemeControl } from "@/components/theme-control";

const capabilities = [
  {
    icon: BrainCircuit,
    number: "01",
    title: "One intelligence",
    text: "A thoughtful place to bring questions, ideas, and the work in between.",
  },
  {
    icon: Command,
    number: "02",
    title: "Every platform",
    text: "A connected experience, designed to move with you across your day.",
  },
  {
    icon: LockKeyhole,
    number: "03",
    title: "Your control",
    text: "Clear permissions and privacy choices, built into the product from the start.",
  },
];

export default function Home() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link href="/" aria-label="Vornokia home"><BrandMark /></Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#vision">Vision</a>
          <a href="#principles">Principles</a>
          <Link href="/app">Workspace</Link>
        </nav>
        <div className="landing-header-actions">
          <ThemeControl compact />
          <Link className="landing-signin" href="/login">Sign in</Link>
          <Link className="button button-primary landing-cta" href="/register">
            Get started <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>

      <section className="landing-hero" id="vision">
        <div className="hero-copy">
          <div className="eyebrow"><span /> A NEW KIND OF INTELLIGENCE</div>
          <h1>One intelligence.<br />Every platform.<br /><span>Infinite possibilities.</span></h1>
          <p>Meet the space where your ideas connect, your work finds momentum, and technology moves at your pace.</p>
          <div className="landing-hero-actions">
            <Link className="button button-primary button-large" href="/register">
              Explore Vornokia <ArrowRight size={17} />
            </Link>
            <a className="text-link" href="#principles">Discover our vision <ArrowDownRight size={15} /></a>
          </div>
          <div className="hero-footnote"><span className="hero-footnote-dot" /> Built around your control, from day one.</div>
        </div>
        <div className="landing-visual" aria-label="Abstract illustration representing connected intelligence">
          <div className="visual-glow" />
          <div className="visual-orbit orbit-outer" />
          <div className="visual-orbit orbit-middle" />
          <div className="visual-orbit orbit-inner" />
          <div className="visual-crosshair crosshair-x" />
          <div className="visual-crosshair crosshair-y" />
          <div className="visual-core"><Sparkles size={31} strokeWidth={1.4} /></div>
          <div className="visual-node visual-node-one"><MessageSquareText size={17} /></div>
          <div className="visual-node visual-node-two"><BrainCircuit size={17} /></div>
          <div className="visual-node visual-node-three"><LockKeyhole size={16} /></div>
          <div className="visual-node visual-node-four"><Command size={17} /></div>
          <div className="visual-caption"><span>VORNOKIA PRIME</span><span>PERSONAL INTELLIGENCE</span></div>
          <div className="visual-coordinate">40°42′ N<br />74°00′ W</div>
          <span className="visual-stamp">V / 001</span>
        </div>
        <div className="hero-bottom-line"><span>01 — A MORE CONNECTED WAY TO THINK</span><span>SCROLL TO EXPLORE <ArrowDownRight size={13} /></span></div>
      </section>

      <section className="principles-section" id="principles">
        <div className="principles-intro">
          <div className="eyebrow"><span /> THE VORNOKIA IDEA</div>
          <h2>Technology should<br />feel like <em>possibility.</em></h2>
          <p>Not more noise. Not another disconnected tool. A calm, capable intelligence that helps you move from thought to action—with you in control.</p>
        </div>
        <div className="capability-list">
          {capabilities.map(({ icon: Icon, number, title, text }) => (
            <article className="capability-item" key={number}>
              <span className="capability-number">{number}</span>
              <span className="capability-icon"><Icon size={20} strokeWidth={1.6} /></span>
              <div><h3>{title}</h3><p>{text}</p></div>
              <ArrowUpRight className="capability-arrow" size={16} />
            </article>
          ))}
        </div>
      </section>

      <section className="landing-closer">
        <div className="closer-orbit closer-orbit-one" />
        <div className="closer-orbit closer-orbit-two" />
        <div className="eyebrow eyebrow-light"><span /> YOUR NEXT THOUGHT STARTS HERE</div>
        <h2>Room for what’s<br /><span>possible.</span></h2>
        <Link className="button button-primary button-large" href="/app">
          Enter the workspace <ArrowRight size={17} />
        </Link>
      </section>

      <footer className="landing-footer">
        <Link href="/" aria-label="Vornokia home"><BrandMark compact /></Link>
        <span>One intelligence. Every platform. Infinite possibilities.</span>
        <div><Link href="/login">Sign in</Link><Link href="/app/settings">Privacy &amp; settings</Link><span>© 2026 Vornokia AI</span></div>
      </footer>
    </main>
  );
}
