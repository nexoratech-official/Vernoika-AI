# Initial Technical Architecture

## Architecture style
Start with a modular monolith. Keep module boundaries explicit. Extract services only when scale, reliability, or team ownership justifies the operational cost.

## Logical request flow
Browser -> Next.js server route -> Authentication -> Authorization / rate limit -> Application service -> Model gateway -> Provider adapter -> Response -> Conversation persistence -> Browser.

## Initial modules
- identity: user sessions and account lifecycle
- conversations: chat threads and messages
- intelligence: request orchestration and prompt assembly
- model_gateway: provider-neutral interface and adapters
- memory: user-approved preferences and future retrieval
- agents: registered specialist prompts, bounded task delegation, communication history, and approval state
- developer platform: owner-scoped application registrations, hashed API keys, API scopes, request quotas, and usage metering
- tools: allowlisted integrations and action execution
- policy: permissions, confirmations, and risk checks
- observability: structured logs, metrics, and error reporting

## Model gateway contract
The initial gateway exposes a `stream(messages, signal)` interface and a model identifier. Its first adapter targets OpenAI-compatible chat-completions endpoints. Add other provider adapters behind this interface without moving provider-specific request formats into browser code or conversation logic.

Provider-specific SDKs and API formats must remain inside adapters. The browser must never call a model provider with a secret key.

Vornokia Prime currently contributes a bounded system instruction for general assistance; it has no tools or external-action permissions.

## Data entities (initial)
- users
- profiles
- conversations
- messages
- user_preferences
- usage_events
- audit_events
- memory_items
- agent_tasks and agent_messages

Use ownership checks on every user-scoped query. Add row-level security when using Supabase.

The first migration is `apps/web/supabase/migrations/20261110223000_vornokia_ai_core.sql`. It includes owner-scoped RLS, usage tracking, and an atomic 20-requests-per-minute per-user chat limit. The chat API uses the authenticated user's session; it does not use a service-role key.

The next migration, `apps/web/supabase/migrations/20261110230800_memory_personalization_agents.sql`, adds owner-scoped user preferences, opt-in memory, agent tasks, and Prime/specialist handoff messages. Memory retrieval is disabled by default and uses simple lexical matching over user-authored memories. Agent approvals record review only; agents have no tools or external-action permissions.

The developer platform migration, `apps/web/supabase/migrations/20261111001000_developer_platform.sql`, adds developer app registrations, metadata-only key reads, scoped API-key creation/revocation, atomic per-key quotas, and owner-visible usage summaries. Key secrets are generated server-side and only SHA-256 hashes are persisted. Narrow `SECURITY DEFINER` functions are the only paths that can create or revoke key records or consume public API quota; no service-role key is required.

The versioned `POST /api/v1/chat/completions` route accepts Vornokia API keys and currently exposes only text chat generation. It can return a JSON completion or OpenAI-style SSE chunks. API prompts and replies are not stored as conversations; request status and provider-reported token counts are metered. The current free-tier limits are 10 requests/minute and 10,000 requests/calendar month per key. A TypeScript SDK source package lives in `packages/sdk`; public package distribution, payment processing, marketplace publishing, and model hosting remain future work.

## API conventions
- Version public APIs when they become public.
- Validate input on the server.
- Return predictable error shapes.
- Add request IDs and structured logs.
- Apply per-user rate and usage limits; record model, status, and provider token counts when supplied.

## Portability
Keep business logic independent from hosting-specific APIs where practical. Keep database migrations in source control. Use environment variables for provider and infrastructure configuration.

## Desktop client
The Tauri v2 desktop package in `apps/desktop` loads the authenticated web application from a build-time-configured HTTPS origin. It grants the native bridge only to that exact origin; the backend and model gateway remain server-side. Local-device operations are narrow Rust commands, protected by session-only permissions, OS-native file selection/confirmation, and an emergency stop. The desktop app does not expose a general shell or filesystem plugin to web content.
