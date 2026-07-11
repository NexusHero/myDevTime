# ADR 0033. Connector scopes & consent — least-privilege, consent-first, per-capability opt-in

## Status

Accepted (owner decision) — the consent/permission foundation for the connectors layer, alongside
ADR-0032 (token vault). Extends the consent-first rule (REQ-025) and the DSGVO package (REQ-020) to
every integration. The remaining connector decisions (GitHub App vs OAuth App, ASR provider per
ADR-0009 / #31, rollout order) stay open.

## Context

Each connector requests OAuth **scopes** and can read or write real user data — code, issues,
chat messages, calendars, meeting transcripts. Two failure modes must be designed out: asking for
more access than a feature needs, and acting (importing/exporting/capturing) without the user's
explicit, informed opt-in. These integrations feed the AI summaries (REQ-014/026) and the
Co-Planner (issues → backlog, calendar → anchors), so they touch the most sensitive surfaces.

## Decision

1. **Least privilege per capability.** Request the narrowest scopes for what the enabled feature
   needs. **Read-only by default**; a write scope (e.g. "create Jira ticket") is requested only when
   the user turns on the matching outbound feature — never bundled into "connect".
2. **Consent stored per connector *and* per capability.** A connection is not one on/off flag but a
   set of opt-ins: **inbound** (import issues/calendar/transcripts), **outbound** (export
   action-items → issues/messages), and **meeting capture** (transcription). Nothing runs without
   the stored opt-in — this generalises REQ-025 ("no capture path without stored explicit opt-in")
   to all connectors.
3. **Preview before write.** Every outbound action shows a preview and requires explicit
   confirmation before it hits the provider (matches F20: "export … after explicit, previewed
   confirmation").
4. **Revocation & erasure.** Disconnect = stop sync + delete tokens (via the ADR-0032 vault) +
   provider-side revoke; connector data is included in the DSGVO export/erasure flows (REQ-020).
5. **Provider data-processing matrix.** For each connector, record what the provider sees, its
   retention, and its training/no-training stance — the same discipline applied to the LLM provider
   (ADR-0005/0029). Meeting transcription stays consent-first with the ASR provider still pending
   (ADR-0009 / #31).
6. **Audit trail** of grants and revocations, per workspace.

## Consequences

- **Safe by construction:** connectors cannot silently over-reach or act without consent; the
  "Integrationen" UI must show real per-capability consent state, replacing the current fake toggle.
- **DSGVO-aligned:** minimisation, purpose limitation, revocation, and erasure are built in, not
  bolted on.
- **Cost:** a more granular consent model in both storage and UX (a connector is several opt-ins,
  not one switch), and a per-connector scope map to maintain.
- **Open (filled as each adapter lands):** the exact scope set per provider; whether some
  read-scopes can be shared across capabilities; the consent-revocation grace behaviour for
  in-flight syncs.
