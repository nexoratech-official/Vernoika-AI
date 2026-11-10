# Vornokia Web

The Vornokia web app is built with Next.js, TypeScript, and Tailwind CSS. It supports a local preview and optional Supabase authentication, PostgreSQL conversation storage, and a server-side OpenAI-compatible streaming gateway.

## Run locally

From the repository root:

```powershell
Copy-Item .env.example apps\web\.env.local
Set-Location apps\web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without service configuration, the app remains in clearly labeled preview mode. Do not enter real credentials in preview mode.

## Configure Supabase

1. Create a Supabase project and copy its project URL and anon/publishable key to `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `apps/web/.env.local`.
2. Apply both migrations in timestamp order using the Supabase SQL editor or Supabase CLI:
   - [`20261110223000_vornokia_ai_core.sql`](./supabase/migrations/20261110223000_vornokia_ai_core.sql)
   - [`20261110230800_memory_personalization_agents.sql`](./supabase/migrations/20261110230800_memory_personalization_agents.sql)
3. Configure the Supabase Auth site URL and redirect allowlist for your app origin, including `/auth/callback`.
4. Set `APP_URL` to the app's origin.

The app uses the signed-in user's session and database row-level security. It does not need a Supabase service-role key.

## Configure the model gateway

Set these server-only variables:

- `AI_BASE_URL` — HTTPS base URL for an OpenAI-compatible chat-completions endpoint.
- `AI_API_KEY` — provider credential; keep it in `.env.local` or a managed secret store.
- `AI_MODEL` — the provider's model identifier.

The endpoint must support bearer authentication, streaming chat completions, `max_tokens`, and the OpenAI-compatible `stream_options.include_usage` field. The browser only calls `/api/chat`; it never receives the provider key.

## Routes

- `/` — product landing page
- `/login` and `/register` — Supabase sign-in/sign-up, or preview navigation when Supabase is absent
- `/auth/callback` — email confirmation callback
- `/app` — workspace overview and recent conversation
- `/app/chat` — simulated local preview or authenticated streaming chat
- `/app/profile` — signed-in account details
- `/app/settings` — opt-in memory retrieval, response preferences, and confirmed chat-history deletion
- `/app/memory` — inspect, add, edit, export, and delete user-controlled memories
- `/app/agents` — specialist registry, Prime handoffs, task progress, and recommendation approvals
- `/api/chat` — authenticated conversation read and streaming endpoint
- `/api/conversations` — authenticated chat-history deletion
- `/api/preferences` and `/api/memories` — owner-scoped personalization controls
- `/api/agents/tasks` — bounded specialist delegation and communication history
- `/api/agents/tasks/approval` — records a user's approval or rejection of a recommendation

Memory is disabled by default and is never inferred from chat automatically. When enabled, lexical matching selects a small set of relevant, user-authored memories for chat context. The short-term context is limited to recent messages in the selected conversation. Preview-mode memory and preferences stay in browser storage and are not sent to a model.

The agent registry contains Prime and seven specialists. Specialist tasks are limited to text recommendations through the configured model gateway, recorded in the user's account, and require explicit review. Agents have no tools or external-action permissions; approving a recommendation records the user's decision and does not execute it.

## Checks

```powershell
npm run lint
npm run typecheck
npm run build
```
