# Vornokia Roadmap

Timelines are estimates, not promises. Re-estimate after each milestone.

## Phase 0 — Foundation
Finalize product, Nexora relationship, identity, architecture, development setup, security baseline, and first-release acceptance criteria.

## Phase 1 — Website and interface
Build the landing page, authentication screens, responsive workspace, navigation, chat UI, profile/settings pages, and loading/error/empty states.

Status: The responsive interface and preview flows are implemented. Supabase authentication can be enabled by configuration.

## Phase 2 — AI core
Connect a model through a server-side provider-independent gateway; add Prime coordination, conversations, streaming, database persistence, configuration, usage, and error handling.

Status: The configurable OpenAI-compatible gateway, authenticated chat route, Supabase migration, streaming client, usage logging, and per-user rate limit are implemented. End-to-end use requires a Supabase project, the migration, and provider credentials.

## Phase 3 — Memory and personalization
Add user-controlled long-term memory, preferences, retrieval, inspection/editing, export/deletion, and privacy controls.

Status: User-authored memory, preference controls, opt-in lexical retrieval, a bounded recent-chat context, and memory inspection/edit/export/deletion are implemented. Supabase persistence requires applying the new migration; preview data is local to the browser.

## Phase 4 — Vornokia Agents
Add the agent registry and bounded capabilities, Prime delegation, agent communication, task tracking, approvals, and agent management.

Status: Prime and seven specialist roles are registered. Signed-in users can delegate bounded text tasks, view the Prime/specialist handoff, track status, and approve or decline recommendations. Agents have no tools or external-action permissions. Live tasks require the database migration and model gateway configuration.

## Phase 5 — Voice and vision
Add opt-in speech-to-text, text-to-speech, voice conversations, image/document input, and explicit media-permission controls.

Status: Authenticated chat supports browser speech dictation/read-aloud, explicit camera capture, resized image input, and local extraction of PDF, DOCX, TXT, Markdown, CSV, and JSON. Media is request-scoped and bounded; persisted chat contains attachment labels only. Speech recognition and image understanding depend on browser/provider support. Preview chat remains simulated and does not include these capabilities.

## Phase 6 — Automation and tool execution
Add an allowlisted tool registry, approved search/retrieval, document processing, authorized integrations, scheduled workflows, execution logs, and confirmations for sensitive actions.

## Phase 7 — Desktop and computer control
Build a Tauri desktop client with permissioned local-device communication, approved file operations, application launching, emergency stop, and platform testing.

Status: A Tauri v2 remote-app shell and a narrow native bridge are implemented. The bridge supports user-selected bounded text files, new-file-only saves, explicitly allowlisted app launches, session-only permissions, and an emergency stop. Windows `cargo check` passes. Production installer builds require the deployed HTTPS origin; installer and macOS/Linux validation remain pending.

## Phase 8 — Mobile applications
Build Flutter clients for Android and iOS with account synchronization, voice, notifications, mobile agents, and device permission controls.

## Phase 9 — Smart home and connected devices
Integrate Home Assistant and selected Matter-compatible devices. Add discovery, explicit controls, routines, and additional safeguards for safety-sensitive devices.

## Phase 10 — Developer platform and API
Add developer registration, API key management, documentation, SDK, testing tools, limits, billing foundations, and scoped app permissions.

## Phase 11 — Marketplace and ecosystem
Add reviewed agent/integration publishing, version management, ratings, security disclosures, and creator/developer profiles.

## Phase 12 — Independent intelligence and global launch
Evaluate open-weight models, model hosting/routing and inference costs, improve reliability and security, establish monitoring/incident response, and prepare public launch/support.

## Release gates
Each phase requires security review, usability testing, measurable acceptance criteria, and a rollback plan before public release. Do not equate an implemented preview with a launch-ready product.
