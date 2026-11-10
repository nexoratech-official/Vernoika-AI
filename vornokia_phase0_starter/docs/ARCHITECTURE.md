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
- agents: future task planning and delegated work
- tools: allowlisted integrations and action execution
- policy: permissions, confirmations, and risk checks
- observability: structured logs, metrics, and error reporting

## Model gateway contract
Define an internal interface such as:
- `generate(input, options)`
- `stream(input, options)` when supported
- `health()` where provider support exists

Provider-specific SDKs and API formats must remain inside adapters. The browser must never call a model provider with a secret key.

## Data entities (initial)
- users
- profiles
- conversations
- messages
- user_preferences
- usage_events
- audit_events

Use ownership checks on every user-scoped query. Add row-level security when using Supabase.

## API conventions
- Version public APIs when they become public.
- Validate input on the server.
- Return predictable error shapes.
- Add request IDs and structured logs.
- Apply per-user rate and usage limits.

## Portability
Keep business logic independent from hosting-specific APIs where practical. Keep database migrations in source control. Use environment variables for provider and infrastructure configuration.
