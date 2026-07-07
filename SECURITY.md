# Security Policy

## Supported versions

This project follows a rolling-release model: only the latest release on `main`
receives security fixes.

| Version         | Supported          |
| --------------- | ------------------ |
| latest (`main`) | :white_check_mark: |
| older tags      | :x:                |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately via a
[GitHub Security Advisory](https://github.com/NexusHero/myDevTime/security/advisories/new).
You can expect an acknowledgement within **72 hours** and a status update within
**7 days**. Once a fix is available we will coordinate a disclosure timeline with you.

## Scope & notes

- The backend (`apps/api`) is a modular monolith. Workspace isolation is enforced
  at the repository layer (every repository API takes a workspace id
  non-optionally) and covered by negative isolation tests — see
  [`CLAUDE.md`](CLAUDE.md) and the ADRs. Report any path that reads or writes
  across workspaces without an explicit workspace id as a security issue.
- AI features never mutate state on their own: LLM/ASR output is always a
  reviewable proposal with provenance (ADR-0005). Report any path where an AI
  provider's response reaches a timesheet, budget, export, or invoice without
  passing through the deterministic core.
- No client or feature talks to a payment SDK directly; feature gates ask the
  `billing` module (entitlement API + credit ledger). Report any direct
  payment-SDK access outside a billing adapter.
- Meeting capture requires stored, explicit opt-in (REQ-025). Report any capture
  path that can run without recorded consent.
- Never commit API keys, tokens, or personal data. `.env` files are git-ignored.
