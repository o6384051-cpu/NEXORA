# NEXORA — Architecture Decision Record

## Product boundary
NEXORA is a new standalone product. It must not import code, secrets, databases, assets, or deployment configuration from OSAMIND or Smart Lab OS unless the owner explicitly requests a reviewed migration.

## Target architecture
- Web client: Next.js App Router, TypeScript, RTL-first.
- Backend boundary: server-only route handlers / service layer.
- Persistence: PostgreSQL behind a repository layer.
- Identity: secure authentication, server-managed sessions.
- AI gateway: provider adapters; secrets stay server-side.
- Agent orchestrator: explicit state machine, tool registry, budgets, approvals, audit trail.
- Execution: isolated ephemeral worker/container; never execute untrusted code in the web process.
- Offline: service worker + IndexedDB for approved local drafts; conflict-aware sync.
- Observability: structured logs, error tracking, usage and cost limits.

## Non-functional requirements
- Least privilege and explicit approval for external side effects.
- Data export and deletion paths.
- Rate limits, quotas, timeouts, retries with bounds.
- Unit, integration, end-to-end, and security tests.
- Accessibility and responsive mobile-first layout.

## Initial release gates
1. Reproducible local install/build.
2. No secrets in client bundle or repository.
3. Arabic RTL layout works on narrow screens.
4. AI routes validate inputs and enforce server-side limits.
5. Agent tools require scoped permissions and approval.
6. Database migrations and backups are documented.
