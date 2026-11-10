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
2. Apply all migrations in timestamp order using the Supabase SQL editor or Supabase CLI:
   - [`20261110223000_vornokia_ai_core.sql`](./supabase/migrations/20261110223000_vornokia_ai_core.sql)
   - [`20261110230800_memory_personalization_agents.sql`](./supabase/migrations/20261110230800_memory_personalization_agents.sql)
   - [`20261111001000_developer_platform.sql`](./supabase/migrations/20261111001000_developer_platform.sql)
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
- `/app/developers` — register developer apps, manage scoped API keys, view metered usage, and test requests
- `/developers/docs` — public API reference
- `/api/chat` — authenticated conversation read and streaming endpoint
- `/api/conversations` — authenticated chat-history deletion
- `/api/preferences` and `/api/memories` — owner-scoped personalization controls
- `/api/agents/tasks` — bounded specialist delegation and communication history
- `/api/agents/tasks/approval` — records a user's approval or rejection of a recommendation
- `/api/developer/apps` and `/api/developer/keys` — authenticated app and API-key management
- `/api/v1/chat/completions` — versioned API-key-authenticated Vornokia Prime endpoint; supports JSON and SSE

The developer endpoint accepts only text `user`/`assistant` messages and the `chat:generate` scope. New keys are generated with cryptographic randomness, stored only as SHA-256 hashes, and shown once. They are limited to 10 requests/minute and 10,000 requests/calendar month per key, with up to five active keys per application and ten per account. Usage metering is enabled; payment processing and billing are not configured. API prompt and response content is not persisted as conversation history. The TypeScript SDK source is in `../../packages/sdk` and is not yet published to a package registry.

Theme controls are available on the landing, authentication, workspace, and API documentation pages. System theme follows the operating-system preference; an explicit light or dark preference is stored in this browser.

Voice conversation mode starts speech recognition after the user enables it, sends each captured utterance to the authenticated chat API, reads the reply aloud, and resumes listening. It is browser-dependent and remains user-controlled; selecting Voice off stops recognition and speech playback. The microphone is requested only after the user explicitly starts voice mode or speech input.

Memory is disabled by default and is never inferred from chat automatically. When enabled, lexical matching selects a small set of relevant, user-authored memories for chat context. The short-term context is limited to recent messages in the selected conversation. Preview-mode memory and preferences stay in browser storage and are not sent to a model.

The agent registry contains Prime and seven specialists. Specialist tasks are limited to text recommendations through the configured model gateway, recorded in the user's account, and require explicit review. Agents have no tools or external-action permissions; approving a recommendation records the user's decision and does not execute it.

## Voice, image, and document input

These features are available in authenticated chat only. The local preview chat remains simulated and does not support voice, image understanding, document analysis, or external model requests.

The authenticated chat supports browser speech recognition for dictation and browser speech synthesis for spoken replies. Microphone access is requested only after the user presses the microphone control. Speech-recognition audio may be processed by the browser's configured speech provider; synthesized playback runs through the browser. Voice mode still leaves sending the recognized text to the user.

Image and camera controls are explicit. Images are resized in the browser, limited to two per request, and sent to the configured model gateway; configure a model that supports image inputs for image understanding. Camera capture requests video-only access after the user presses Camera, and the camera stream stops after capture or when closed.

PDF text, DOCX text, TXT, Markdown, CSV, and JSON files are extracted locally before sending. Each document is limited to 3 MB and extracted text to 16,000 characters; at most two images and two documents can be attached per message. Files and image data are not stored in the account. Extracted document text and image contents are sent to the configured AI provider for the current request; attachment names, but not contents, are recorded in the saved message. Scanned PDFs without selectable text need a vision-capable model and an image of the relevant page.

## Checks

```powershell
npm run lint
npm run typecheck
npm run build
```
