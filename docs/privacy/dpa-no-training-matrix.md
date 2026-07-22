# Sub-processor / DPA & No-Training Matrix (REQ-020)

**Status:** Living document. Owned by the `privacy` posture (REQ-020), governed by ADR-0033
(connector scopes & consent, §Decision point 5 — "Provider data-processing matrix"), ADR-0005
(deterministic core, LLMs propose only), ADR-0032 (connector token vault) and ADR-0029 (LLM
provider port).

This document records **every external data processor** the system can reach, the data it would
see, the legal basis for sending it, and the contractual no-training / no-retention requirement we
place on it. It is the data-protection counterpart to the code: every processor below is reached
through a **single port-and-adapter** (process skill §2.2) and is **environment-gated** — dormant,
resolving to a `Null…` adapter, until its secrets are configured. **With a default deployment (no
provider secrets set) no personal data leaves the system at all.**

---

## 1. How exposure is bounded by construction

Three architectural rules cap what any sub-processor can ever see:

1. **Ports & adapters (skill §2.2).** Each vendor's wire types live in exactly one adapter file.
   Nothing upstream imports a vendor SDK, so a processor can be swapped, self-hosted, or removed
   without touching the core.
2. **Env-gated, dormant-by-default.** Every adapter's `useFactory` reads configuration from the
   environment and falls back to a `Null…` adapter when unset. No key ⇒ no network call ⇒ no data
   egress. This is verified in each provider module (e.g. `llm.provider.ts`,
   `transcription.provider.ts`, `target.provider.ts`).
3. **Proposal-only AI (ADR-0005).** LLM/ASR output is always a **proposal** with provenance; it
   never mutates a timesheet, budget, invoice, or export on its own. The deterministic core in
   `packages/domain` computes every number that reaches a record. A processor therefore never
   becomes a system of record — it only ever sees inputs it is asked to phrase or parse, and its
   output is validated before a human confirms it.

---

## 2. Sub-processor matrix

Legal-basis column uses GDPR Art. 6(1): **(b)** performance of contract, **(f)** legitimate
interest, **(a)** consent. "DPA req." = a Data Processing Agreement / Art. 28 processor contract is
required before the adapter may be enabled in production.

| Processor | Purpose (feature) | Data categories sent | Legal basis | DPA req. | No-training / retention requirement | Confining adapter | Env gate (dormant until set) |
|-----------|-------------------|----------------------|-------------|----------|--------------------------------------|-------------------|------------------------------|
| **LLM provider** (OpenAI · Anthropic · Google Gemini · self-hosted Ollama · OpenRouter gateway) | Categorization proposals, NL time entry, summaries, grounded assistant, meeting-insight phrasing (REQ-012/014/026) | Prompt text derived from user content: entry titles/notes, transcript fact lines, project/task names. No credentials; no raw audio. | (b)/(f); (a) where content is meeting-derived | **Y** (hosted); **N** for Ollama (self-hosted, in-tenant) | Opt out of training on inputs/outputs; zero or short retention; EU/region processing where offered. Ollama = **privacy default**, no third party sees data. | `modules/ai/llm/vercel-llm.ts` (Vercel AI SDK; vendor types confined here) | `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY` / `LLM_BASE_URL` → else `NullLlm` (`modules/ai/llm/llm.provider.ts`) |
| **ASR provider** (self-hosted faster-whisper/speaches · hosted OpenAI Whisper) | Meeting transcription → neutral `TranscriptSegment[]` (REQ-025) | Captured meeting audio bytes; returns transcript text | (a) — **consent-first, mandatory** (REQ-025) | **Y** (hosted); **N** for self-hosted box (in-tenant) | Same as LLM: no-training, zero/short retention. **Self-hosted faster-whisper is the privacy default** — no key, audio never leaves the deployment. | `modules/ai/transcription/whisper-http.ts` (OpenAI-compatible `/v1/audio/transcriptions`; wire types confined here) | `ASR_PROVIDER=whisper-http`, `ASR_BASE_URL`, `ASR_API_KEY`, `ASR_MODEL` → else `NullTranscription` (`modules/ai/transcription/transcription.provider.ts`) |
| **Stripe** | Web subscription checkout, billing portal, entitlement webhooks (REQ-017) | Workspace id, customer email (optional), subscription status. Card data handled by Stripe, **never** reaches our servers. | (b) | **Y** | Payment processor DPA; retention per Stripe's financial-record obligations. We store only the entitlement event + customer id. | `modules/billing/payments/stripe/gateway.ts` (`Stripe.*` types confined here) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Apple StoreKit / Google Play Billing** | In-app subscription entitlement (REQ-018/023) | Store transaction / entitlement notifications mapped to a workspace | (b) | **Y** | Store DPAs; we persist only the normalized `EntitlementEvent`. | `PaymentProviderPort` (`modules/billing/payments/port.ts`) — **adapter not yet built (#23)**, see §5 | (planned) |
| **Google Calendar** | Read-only events as capture candidates (REQ-010) | Calendar events (title, start/end) for the requested window; read-only OAuth scope | (a) — per-capability consent (ADR-0033) | **Y** | Read-only scope by default (`calendar.readonly`); events become **ghost proposals**, never auto-booked (ADR-0005). Tokens sealed in the vault (ADR-0032). | `modules/calendarsync/google-calendar.ts` (`CalendarPort`; Google wire shape confined here) | OAuth via connectors vault: `CONNECTOR_MASTER_KEY`, provider client id/secret, redirect base → else "not configured" |
| **Apple Calendar** | Read-only events as capture candidates (REQ-010) | Same as Google Calendar | (a) | **Y** | Same as Google; **live adapter spike-gated** (design v17 §F6) — registry entry exists, no live path yet. | `CalendarPort` (registry `apple-calendar`, `modules/connectors/registry.ts`) — adapter planned | (planned) |
| **Jira Cloud** (export target) | Push a **confirmed** action item as one issue (REQ-035) | Issue title/body from a confirmed proposal; outbound only, previewed | (a) — `outbound` capability consent + preview-before-write (ADR-0033) | **Y** | Least-privilege write scope requested only when the outbound capability is on; one confirmed item → one issue. | `modules/ai/export/jira-target.ts` (`ExportTargetPort`; Jira REST/ADF confined here) | `EXPORT_JIRA_BASE_URL`, `EXPORT_JIRA_EMAIL`, `EXPORT_JIRA_API_TOKEN`, `EXPORT_JIRA_PROJECT_KEY` → else `NullExportTarget` |
| **Linear** (export target) | Push a confirmed action item as one issue (REQ-035) | Issue title/body from a confirmed proposal; outbound only, previewed | (a) | **Y** | As Jira. | `modules/ai/export/linear-target.ts` (`ExportTargetPort`) | `EXPORT_LINEAR_API_KEY`, `EXPORT_LINEAR_TEAM_ID` → else `NullExportTarget` |
| **Slack** (export target) | Post a confirmed summary/action item to a channel (REQ-035) | Message text from a confirmed proposal; outbound only, previewed | (a) | **Y** | As Jira. | `modules/ai/export/slack-target.ts` (`ExportTargetPort`) | `EXPORT_SLACK_BOT_TOKEN`, `EXPORT_SLACK_CHANNEL` (`EXPORT_SLACK_TEAM_URL` optional) → else `NullExportTarget` |

> All export targets resolve through one env-gated factory (`modules/ai/export/target.provider.ts`);
> an unconfigured target is the `NullExportTarget`, whose `available()` is always false, so the
> export runner degrades to an honest `unavailable` outcome rather than sending anything.

---

## 3. No-training / no-retention policy

For any **hosted** LLM or ASR provider, the following are contractual pre-conditions to enabling the
adapter in production (they align with ADR-0033 §5, which mandates recording each provider's
retention and training stance):

1. **No training on our inputs or outputs.** The provider must contractually exclude our prompts,
   completions, audio, and transcripts from model training / fine-tuning corpora (e.g. via the
   provider's zero-data-retention or enterprise no-training terms).
2. **Zero or short retention.** Inputs must be retained only as long as needed to serve the request
   (abuse-monitoring windows only where unavoidable and covered by DPA), then deleted.
3. **Regional processing where offered**, to keep data-residency commitments (§6).
4. **DPA / Art. 28 processor contract in force** before the key is set.

**Why the blast radius is small even so (ADR-0005):**

- The AI layer only ever produces **proposals** — it never writes to a timesheet, invoice, budget,
  or export. Every number of record is computed by the deterministic core in `packages/domain`.
- Prompts are assembled from **already-user-authored content** (entry titles/notes, transcript fact
  lines). No credentials, OAuth tokens, or payment data are ever placed in a prompt — those live in
  the auth-internal tables and the sealed token vault (ADR-0032), which are excluded from every
  AI path.
- **Self-hosting is a first-class option, not a hardship path.** Ollama (LLM, ADR-0029) and a
  self-hosted faster-whisper box (ASR, ADR-0009) both run entirely in-tenant with **no key and no
  third-party egress** — the recommended posture for privacy-sensitive workspaces.
- A down or unconfigured provider **degrades gracefully** to a `Null…` adapter and an empty result;
  no feature hard-fails and no data is sent as a side effect.

---

## 4. Data-subject rights — the real endpoints

Data-subject requests are served by the **`privacy` module** (REQ-020). Every route resolves the
workspace from the authenticated caller (`AuthGuard`), never from the client, so a user can only
ever export or erase their **own** data (ADR-0015 isolation by construction). No AI touches this
path — it is plain, deterministic persistence (ADR-0005).

| Right (GDPR) | Endpoint | Behaviour | Source |
|--------------|----------|-----------|--------|
| Access / Portability (Art. 15/20) | `GET /api/privacy/export` | A complete machine-readable JSON bundle: the caller's `user` + `workspace` rows plus every row of every workspace-scoped table, keyed by table name. Soft-deleted tombstones are **included** (still stored personal data). | `modules/privacy/privacy.controller.ts` → `exportWorkspaceData` (`modules/privacy/service.ts`) |
| Erasure (Art. 17) | `DELETE /api/privacy/account` | Hard-deletes the workspace (every workspace-scoped table cascades off the `workspace_id` FK) and the identity (`session`/`account` cascade off `user`; `verification` removed by email). Guarded by an explicit `confirm: "DELETE"` literal — a request without it never reaches the handler. Returns `204`. | `modules/privacy/privacy.controller.ts` → `eraseAccount` |
| Storage limitation (Art. 5(1)(e)) | `POST /api/privacy/retention/purge` | Hard-deletes soft-deleted tombstones older than the retention window across every table that carries `deleted_at` (`time_entries`, `tasks`, `projects`, `clients`, `tags`, `rules`); live rows (`deleted_at` NULL) are never touched. Cut-off is pure, deterministic arithmetic (`retentionCutoff`). | `modules/privacy/privacy.controller.ts` → `purgeSoftDeleted` |

**Secret-material exclusions (data minimisation in the export itself):**

- Auth-internal tables (`session`, `account`, `verification`) are excluded — they hold credentials
  and secrets, not user content.
- `connector_tokens` are exported as **metadata only**; the sealed OAuth access/refresh ciphertext
  (ADR-0032/0033) is deliberately stripped — secret material has no place in a portability export
  (`modules/privacy/service.ts`, `connectorTokens` projection).

**Connector-side revocation** is part of erasure: disconnecting a connector deletes its sealed
tokens and revokes every capability grant (ADR-0033) — see the consent-points inventory,
`docs/privacy/consent-points.md`.

---

## 5. Planned-not-built (honest gaps)

- **Store IAP adapters (Apple StoreKit / Google Play).** Only the `PaymentProviderPort` interface
  exists (`modules/billing/payments/port.ts`); no concrete adapter ships yet (#23). Until then no
  store data is processed.
- **Apple Calendar live adapter.** Registered in the connector registry with least-privilege
  scopes, but the live CalDAV/Sign-in-with-Apple adapter is spike-gated (design v17 §F6).
- **Live hosted-ASR handback.** `WhisperHttp` ships, but the hosted-provider production path
  (real audio + an EU host/vendor key + WER eval) is an external handback; ADR-0009 stays Proposed.
- **Per-provider DPA references.** The concrete signed-DPA URLs / contract references per hosted
  vendor are filled into §2 as each provider is actually enabled in a deployment.

---

## 6. Data residency & minimisation

- **Primary store.** PostgreSQL, single managed instance (ADR-0015); driver confined to the `db`
  module, never imported by `packages/domain`. Residency is a deployment choice (host the instance
  in the required region).
- **Minimisation at the boundary.** Read-only calendar scope by default; least-privilege connector
  scopes (a write scope only when the matching outbound capability is on, ADR-0033); prompts carry
  only the content a feature needs; transcripts are consent-gated (REQ-025).
- **No secrets in AI paths.** Credentials live in auth-internal tables; OAuth tokens are sealed in
  the vault (ADR-0032). Neither is ever placed in a prompt or an export.

### Retention schedule

| Data class | Store | Retention rule | Enforcement |
|------------|-------|----------------|-------------|
| Live workspace data (entries, projects, invoices, …) | PostgreSQL | Kept while the workspace lives | Deleted on Art. 17 erasure |
| Soft-deleted tombstones (`deleted_at` set) | PostgreSQL | Purged past the configured window | `POST /api/privacy/retention/purge` (`purgeSoftDeleted`) |
| Sealed connector tokens | PostgreSQL (encrypted, ADR-0032) | Until disconnect / erasure | Deleted on disconnect (`DELETE /api/connectors/:id`) + Art. 17 |
| Auth sessions / accounts / verification | PostgreSQL (auth-internal) | Per auth lifecycle | Cascade-deleted on Art. 17 erasure |
| LLM / ASR provider inputs | External processor | **Zero / short** (contractual, §3) | Provider DPA + no-training terms |
| Payment records (Stripe / stores) | External processor | Per financial-record obligation | Provider DPA |

---

## 7. Traceability

| Claim | Source |
|-------|--------|
| GDPR export/erasure/purge endpoints | `apps/api/src/modules/privacy/privacy.controller.ts`, `apps/api/src/modules/privacy/service.ts` |
| LLM adapter + env gate | `apps/api/src/modules/ai/llm/vercel-llm.ts`, `.../llm/llm.provider.ts` (ADR-0029) |
| ASR adapter + env gate | `apps/api/src/modules/ai/transcription/whisper-http.ts`, `.../transcription/transcription.provider.ts` (ADR-0009) |
| Stripe adapter | `apps/api/src/modules/billing/payments/stripe/gateway.ts`; store port `.../payments/port.ts` (ADR-0006) |
| Calendar adapter + registry scopes | `apps/api/src/modules/calendarsync/google-calendar.ts`, `.../connectors/registry.ts` |
| Export targets (Jira/Linear/Slack) | `apps/api/src/modules/ai/export/{jira,linear,slack}-target.ts`, `.../export/target.provider.ts` |
| Token vault (sealed tokens) | ADR-0032; `apps/api/src/modules/connectors/vault.ts` |
| Provider data-processing matrix mandate | ADR-0033 §Decision 5 |
| Proposal-only bound | ADR-0005 |
