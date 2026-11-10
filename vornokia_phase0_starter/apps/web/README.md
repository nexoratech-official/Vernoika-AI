# Vornokia Web App

The first product is a responsive web application.

## Suggested implementation order
1. Design tokens and application shell.
2. Sign-in and onboarding.
3. Dashboard and navigation.
4. Chat UI with mocked responses.
5. Server-side model gateway.
6. Conversation persistence.
7. Preferences and privacy controls.
8. Loading, error, and offline states.
9. Accessibility and responsive QA.

## Suggested routes
- `/` — landing page
- `/login` — authentication
- `/app` — main workspace
- `/app/chat/[conversationId]` — conversation
- `/app/agents` — future agent workspace
- `/app/devices` — future connected devices
- `/app/settings` — account, privacy, and preferences

Do not expose provider API keys in client components or public environment variables.
