"use client";

import {
  ArrowUpRight,
  Bot,
  Command,
  Brain,
  Code2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Settings2,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "./brand-mark";
import { ThemeControl } from "./theme-control";
import { signOutAction } from "@/app/actions/auth";

const navigation = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/chat", label: "Chat", icon: MessageSquareText },
  { href: "/app/memory", label: "Memory", icon: Brain },
  { href: "/app/agents", label: "Agents", icon: Bot },
  { href: "/app/developers", label: "Developers", icon: Code2 },
];

const accountNavigation = [
  { href: "/app/profile", label: "My profile", icon: UserRound },
  { href: "/app/settings", label: "Settings", icon: Settings2 },
];

type WorkspaceIdentity = { displayName: string; email: string };

export function AppShell({
  children,
  identity,
  authenticated,
  aiConfigured,
}: {
  children: React.ReactNode;
  identity: WorkspaceIdentity | null;
  authenticated: boolean;
  aiConfigured: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    setSignOutError("");
    try {
      const result = await signOutAction();
      if (!result.ok) {
        setSignOutError(result.error ?? "Sign-out failed. Please try again.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("Sign-out is temporarily unavailable. Please try again.");
    }
  }

  function isActive(href: string) {
    return href === "/app" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="workspace-frame">
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar${menuOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Link className="sidebar-brand" href="/app" onClick={() => setMenuOpen(false)}>
            <BrandMark compact />
          </Link>
          <button
            className="icon-button sidebar-close"
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <Link
          className="workspace-switcher"
          href="/app"
          onClick={() => setMenuOpen(false)}
        >
          <span className="workspace-avatar"><Command size={17} /></span>
          <span className="workspace-switcher-copy">
            <span>Personal workspace</span>
            <small>Free plan</small>
          </span>
          <ArrowUpRight className="workspace-switcher-arrow" size={15} />
        </Link>

        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              className={`nav-link${isActive(href) ? " nav-link-active" : ""}`}
              href={href}
              key={href}
              aria-current={isActive(href) ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Chat" && <span className="nav-shortcut">⌘ K</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-section-label sidebar-account-label">Account</div>
        <nav className="sidebar-nav" aria-label="Account navigation">
          {accountNavigation.map(({ href, label, icon: Icon }) => (
            <Link
              className={`nav-link${isActive(href) ? " nav-link-active" : ""}`}
              href={href}
              key={href}
              aria-current={isActive(href) ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          <div className="sidebar-online">
            <span className={aiConfigured ? "" : "sidebar-status-pending"} />
            {aiConfigured
              ? "AI gateway is configured"
              : authenticated
                ? "Account connected · AI setup needed"
                : "Demo workspace is ready"}
          </div>
          <div className="sidebar-user-row">
            <Link className="sidebar-user" href="/app/profile" onClick={() => setMenuOpen(false)}>
              <span className="avatar avatar-small">{identity?.displayName.charAt(0).toUpperCase() ?? "V"}</span>
              <span className="sidebar-user-copy">
                <strong>{identity?.displayName ?? "Vornokia user"}</strong>
                <small>{identity?.email ?? "Preview account"}</small>
              </span>
              <Settings2 size={16} />
            </Link>
            {authenticated && (
              <button
                className="icon-button signout-button"
                type="button"
                aria-label="Sign out"
                onClick={() => void handleSignOut()}
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
          {signOutError && <p className="sidebar-action-error" role="alert">{signOutError}</p>}
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <button
            className="icon-button mobile-menu-button"
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={19} />
          </button>
          <div className="topbar-context">
            <span className="topbar-context-label">Vornokia workspace</span>
            <span className="topbar-divider">/</span>
            <span className="topbar-context-current">
              {pathname.startsWith("/app/chat")
                ? "Chat"
                : pathname.startsWith("/app/memory")
                  ? "Memory"
                  : pathname.startsWith("/app/agents")
                    ? "Agents"
                    : pathname.startsWith("/app/developers")
                      ? "Developers"
                : pathname.startsWith("/app/settings")
                  ? "Settings"
                  : pathname.startsWith("/app/profile")
                    ? "Profile"
                    : "Overview"}
            </span>
          </div>
          <div className="topbar-right">
            <ThemeControl />
            <span className={`demo-pill${aiConfigured ? " demo-pill-ready" : ""}`}>
              <span />{aiConfigured ? "AI gateway connected" : authenticated ? "AI setup needed" : "Preview environment"}
            </span>
            <Link className="avatar avatar-top" href="/app/profile" aria-label="Open profile">V</Link>
          </div>
        </header>
        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}
