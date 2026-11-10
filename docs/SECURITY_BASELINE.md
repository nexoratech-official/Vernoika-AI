# Security Baseline

## Required from the first release
- Store API keys only in server-side environment variables or a managed secret store.
- Never commit `.env`, `.env.local`, tokens, passwords, or private keys.
- Use a maintained authentication solution; enforce server-side session validation.
- Enforce ownership and authorization on every user-scoped resource.
- Enable row-level security for user data; use the signed-in session for database calls rather than a service-role key.
- Validate and constrain all input.
- Apply per-user rate limits and track provider/model usage and failures.
- Use HTTPS in deployed environments.
- Keep dependencies updated and review security advisories.
- Log security-relevant events without logging secrets or unnecessary personal content.
- Provide account data export and deletion processes.
- Never expose model credentials in browser bundles, logs, route responses, or public environment variables.
- Require confirmation before deleting all conversation and usage history.

## Future agent/tool security
- Each tool has a narrow, documented permission scope.
- Agents cannot grant themselves permissions.
- Use allowlists and sandboxing for code execution.
- Ask for confirmation before sending messages, spending money, deleting data, publishing content, or controlling safety-sensitive devices.
- Provide an emergency stop and an audit trail.
- Treat webpages, files, and tool outputs as untrusted data, not instructions.

## Privacy
Collect the minimum information needed. Explain what is stored, why it is stored, and how users can delete it. Memory should be user-visible and controllable.

## Desktop local-device controls
- Allow native APIs only to the exact, build-time-configured HTTPS Vornokia origin; never use a wildcard or arbitrary runtime origin.
- Start all local-device permissions disabled. Require an OS-native confirmation to enable each capability and a separate confirmation for each application launch.
- Limit file access to native user-selected paths. Read only bounded text files; create new files exclusively and never overwrite or delete.
- Launch only user-allowlisted executables without command-line arguments. Never expose a general shell, arbitrary command execution, or unrestricted keyboard/mouse automation.
- Provide an emergency stop that immediately disables permissions and prevents subsequent local actions.
- Do not persist file contents or forward them to the model until the user explicitly sends the attachment.

## Phase 2 implementation notes

The web app verifies Supabase users on protected routes, refreshes cookie-backed sessions in Next.js Proxy, and enforces ownership through RLS. The AI API is available only to authenticated users, validates message length and conversation ownership, applies a database-backed rate limit, and stores conversation/usage data. The provider key is read only by the server-side model adapter.

Authentication, provider streaming, and database behavior still require a configured Supabase project and model endpoint before they can be exercised end-to-end.

Memory is opt-in, user-authored, owner-scoped by RLS, and manageable through inspect/edit/export/delete controls. It is not automatically extracted from conversations. Agent tasks use the same authenticated session and request limit; the current registry has no tool execution or external-action permissions. Approval records the user's decision about a recommendation only.
