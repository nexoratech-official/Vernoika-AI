# Vornokia AI — Phase 0 Starter

Vornokia is an independent, cross-platform AI ecosystem. Its flagship product is a web-first assistant powered by a modular intelligence backend. Nexora is a smaller, separate AI counterpart; it is not Vornokia's parent.

## Phase 0 objective
Establish the product definition, brand system, architecture, repository, security baseline, and first release scope before building features.

## Current product principle
Build a useful, secure Vornokia Alpha before attempting unrestricted device control or a proprietary foundation model.

## Proposed stack
- Next.js + TypeScript
- Tailwind CSS + shadcn/ui
- Next.js server-side routes for the initial modular monolith
- PostgreSQL via Supabase initially
- Provider-independent AI model gateway
- Git + GitHub
- Vercel or another portable hosting provider

## Start locally (when implementing the web app)
1. Install current Node.js LTS and Git.
2. Run `npx create-next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir`.
3. Follow the prompts and commit the generated scaffold.
4. Add dependencies only when a feature requires them.
5. Never put provider secrets in browser code or commit `.env.local`.

## Repository guide
- `docs/PRODUCT_BRIEF.md` — product vision and MVP boundaries
- `docs/ARCHITECTURE.md` — initial technical architecture
- `docs/BRAND_SYSTEM.md` — visual identity
- `docs/PHASE0_CHECKLIST.md` — Phase 0 execution checklist
- `docs/SECURITY_BASELINE.md` — minimum security requirements
- `docs/ROADMAP.md` — staged roadmap
- `apps/web/README.md` — web application implementation notes

This is a planning and foundation starter, not a finished application. No integrations or AI features are implemented yet.
