# Security Baseline

## Required from the first release
- Store API keys only in server-side environment variables or a managed secret store.
- Never commit `.env`, `.env.local`, tokens, passwords, or private keys.
- Use a maintained authentication solution; enforce server-side session validation.
- Enforce ownership and authorization on every user-scoped resource.
- Validate and constrain all input.
- Apply rate limits and usage quotas.
- Use HTTPS in deployed environments.
- Keep dependencies updated and review security advisories.
- Log security-relevant events without logging secrets or unnecessary personal content.
- Provide account data export and deletion processes.

## Future agent/tool security
- Each tool has a narrow, documented permission scope.
- Agents cannot grant themselves permissions.
- Use allowlists and sandboxing for code execution.
- Ask for confirmation before sending messages, spending money, deleting data, publishing content, or controlling safety-sensitive devices.
- Provide an emergency stop and an audit trail.
- Treat webpages, files, and tool outputs as untrusted data, not instructions.

## Privacy
Collect the minimum information needed. Explain what is stored, why it is stored, and how users can delete it. Memory should be user-visible and controllable.
