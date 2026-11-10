# Vornokia Web Interface and AI Core

The web app in `apps/web` uses the Next.js App Router, TypeScript, and a midnight-navy/cyan visual system from `BRAND_SYSTEM.md`.

## Routes and behavior

- `/` — product landing page
- `/login`, `/register`, and `/auth/callback` — account sign-in, registration, and confirmation
- `/app` — workspace overview with recent chat
- `/app/chat` — local simulated preview or signed-in streamed assistant
- `/app/memory` — user-controlled memory management and export
- `/app/agents` — specialist task delegation and recommendation review
- `/app/profile` — verified account details
- `/app/settings` — opt-in memory and personalization preferences
- `/api/chat` — user-scoped conversation retrieval and streaming
- `/api/conversations` — delete the signed-in user's chat and usage history
- `/api/memories` and `/api/preferences` — owner-scoped memory and preference APIs
- `/api/agents/tasks` — bounded specialist delegation and task history

Without Supabase settings, the app clearly stays in preview mode: sign-in routes to the preview workspace, simulated replies are stored in browser local storage, and no credentials are verified. With Supabase configured, workspace routes require a verified user session. Live chat additionally requires the model gateway settings.

## Phase 2 architecture

The browser sends chat requests only to the Next.js server route. The route validates the request, checks the user's session and database row-level policies, applies an atomic per-user rate limit, stores messages, and streams a response from the server-configured OpenAI-compatible endpoint. Vornokia Prime supplies the coordinator prompt; provider-specific transport remains behind the `ModelGateway` interface.

Database tables and policies are in `apps/web/supabase/migrations`. There is no service-role key in the application. Conversation and usage reads/writes run with the authenticated user's cookie-backed client and RLS.

## Phase 3 and 4

Memory is authored and managed by the user; it is not extracted automatically from chat. Retrieval is off by default and includes only a small, lexically relevant set of user-owned memories when enabled. Response style is an explicit preference. Recent messages from the active conversation provide short-term context.

Prime coordinates seven specialist agents. Tasks and Prime/specialist messages are saved to the user's account. Agents only return model-generated recommendations; they cannot run tools or external actions. Approve/decline records the user's review and does not execute an action.

## Configuration and remaining operations

Copy `.env.example` to `apps/web/.env.local`, configure the Supabase project and model provider, then apply both database migrations in timestamp order. Configure Supabase Auth's site URL and redirect allowlist for `/auth/callback`. Keep `AI_API_KEY` server-only; never add secrets to public or client environment variables.

Live provider and Supabase behavior cannot be exercised until the project migration and credentials are configured. The local preview, production build, type checks, route smoke tests, chat persistence, and responsive navigation can be checked without those secrets.
