# Vornokia AI

Vornokia is an independent, cross-platform AI ecosystem. Its flagship product is a web-first assistant powered by a modular intelligence backend. Nexora is a separate, smaller AI counterpart; it is not Vornokia's parent.

## Current status

This repository contains the responsive web app and optional Supabase-backed authentication, conversation storage, user-controlled memory, specialist agents, and an OpenAI-compatible server-side streaming gateway. External services are not configured by default. Without local service settings, the app runs as a clearly labeled preview.

## Run the web app

Install current Node.js LTS, then from the repository root:

```powershell
Copy-Item .env.example apps\web\.env.local
Set-Location apps\web
npm install
npm run dev
```

See [`apps/web/README.md`](./apps/web/README.md) for Supabase setup, database migration, model configuration, and validation commands. Never put provider secrets in browser code or commit `.env.local`.

## Project guide

- `docs/PRODUCT_BRIEF.md` — product vision and MVP boundaries
- `docs/ARCHITECTURE.md` — technical architecture and request flow
- `docs/BRAND_SYSTEM.md` — visual identity
- `docs/PHASE0_CHECKLIST.md` — Phase 0 execution checklist
- `docs/SECURITY_BASELINE.md` — security and privacy requirements
- `docs/ROADMAP.md` — staged roadmap
- `docs/WEB_IMPLEMENTATION_NOTES.md` — current web and AI core behavior
- `apps/web/README.md` — local setup and service configuration

The web app is not a public launch. Configure and verify the external services, security policies, and production deployment before inviting users.
