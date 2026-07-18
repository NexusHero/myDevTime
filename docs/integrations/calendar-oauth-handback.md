# Calendar OAuth go-live handback — what exists, what is external, what code remains

**Issues:** [#15](https://github.com/NexusHero/myDevTime/issues/15) (REQ-010, calendar
integration) · [#43](https://github.com/NexusHero/myDevTime/issues/43) (REQ-034, calendar
write-back, ADR-0012) · **Decisions:**
[ADR-0032](../adr/0032-connector-token-vault.md) (token vault) ·
[ADR-0033](../adr/0033-connector-scopes-and-consent.md) (scopes & consent) ·
[ADR-0005](../adr/0005-deterministic-core-llm-assist.md) (proposals, never auto-commits)

## Verdict — **the entire in-repo half is built and tested; going live is blocked only on registered OAuth apps (credentials) plus one adapter file per provider**

The connectors/calendar stack was deliberately built inside-out: everything that does not
require a vendor account exists, is integration-tested, and reports its own absence honestly
("Planned" in the UI, `configured: false` on the API). This document records precisely where
the seam is, so the external steps can be executed without re-discovering the code.

## What already exists (grounded, with paths)

### Server — the `connectors` module ([`apps/api/src/modules/connectors/`](../../apps/api/src/modules/connectors/connectors.module.ts))

- **Registry** ([`registry.ts`](../../apps/api/src/modules/connectors/registry.ts)): pure data
  for the seven connectors incl. `google-calendar` and `apple-calendar`, each with
  per-capability least-privilege scopes — Google Calendar's `inbound` capability requests only
  `https://www.googleapis.com/auth/calendar.readonly`; `capture` adds no scopes.
  `scopesForGrantedCapabilities` computes the minimal scope set from stored consent: no
  consent → no scopes (ADR-0033).
- **Sealed token vault** ([`vault.ts`](../../apps/api/src/modules/connectors/vault.ts) +
  [`crypto.ts`](../../apps/api/src/modules/connectors/crypto.ts)): tokens are envelope-encrypted
  (AEAD) under **`CONNECTOR_MASTER_KEY`** (must be 32 bytes) before they touch the DB and are
  opened only inside the vault; every query is keyed by `(workspaceId, userId, connector)` —
  workspace isolation by construction (ADR-0032).
- **Per-capability consent** ([`consent.ts`](../../apps/api/src/modules/connectors/consent.ts)):
  stored, explicit opt-in per capability (`inbound`/`outbound`/`capture`), with
  `revokeAllGrants` as part of disconnect — the REQ-025 consent-first rule generalised to
  every integration.
- **Honest status + OAuth URL assembly**
  ([`service.ts`](../../apps/api/src/modules/connectors/service.ts)): `configured` means the
  provider's client id is present in the environment (`clientIdEnvKey`), `connected` means a
  sealed token exists (`hasToken`), and `buildAuthorizeUrl` deterministically assembles the
  provider authorize URL (endpoint map incl.
  `https://accounts.google.com/o/oauth2/v2/auth` and
  `https://appleid.apple.com/auth/authorize`) from client id + redirect URI + state + the
  consented scopes. Pure and unit-tested
  ([`service.test.ts`](../../apps/api/src/modules/connectors/service.test.ts)) — **not yet
  mounted on any route** (see "remaining code").
- **Endpoints** ([`connectors.controller.ts`](../../apps/api/src/modules/connectors/connectors.controller.ts)),
  behind `AuthGuard`, integration-tested
  ([`connectors.integration.test.ts`](../../apps/api/src/modules/connectors/connectors.integration.test.ts)):
  - `GET /api/connectors` — honest status list (configured / connected / per-capability consent)
  - `PUT /api/connectors/:id/consent` — record one capability's grant
  - `DELETE /api/connectors/:id` — disconnect: delete sealed tokens + revoke all grants

### Server — the calendar sync port ([`apps/api/src/modules/calendarsync/`](../../apps/api/src/modules/calendarsync/port.ts))

- [`port.ts`](../../apps/api/src/modules/calendarsync/port.ts): the one narrow `CalendarPort`
  (`fetchEvents(range) → ExternalEvent[]`, `available()`), providers `google | apple | null`,
  read-only by contract; vendor types must stay inside the single adapter file (skill §2.2).
- [`null-calendar.ts`](../../apps/api/src/modules/calendarsync/null-calendar.ts): the
  graceful-degradation default (never available, refuses with `CalendarUnavailableError`).
- [`service.ts`](../../apps/api/src/modules/calendarsync/service.ts): `planImport` — consent-
  gated, availability-gated, then the deterministic `mergeCalendar` diff from
  `packages/domain`; output is a **proposal** (ghost blocks to confirm), never a write
  (ADR-0005). Tested in [`service.test.ts`](../../apps/api/src/modules/calendarsync/service.test.ts).
- Honest wiring status: this directory is a tested seam, **not yet a Nest module** — nothing
  outside `calendarsync/` imports it, and the `automation` module (the intended home of
  calendar *ingestion*, REQ-010) currently exposes only its `/api/automation/status` stub
  ([`automation.controller.ts`](../../apps/api/src/modules/automation/automation.controller.ts));
  its rules-engine half is real ([`rules.controller.ts`](../../apps/api/src/modules/automation/rules.controller.ts)).

### Client

- [`apps/mobile/src/api/connectors.ts`](../../apps/mobile/src/api/connectors.ts): the typed
  client for the three endpoints above (zod-parsed `configured`/`connected`/capabilities).
- [`useConnectors`](../../apps/mobile/src/hooks/useConnectors.ts): TanStack-Query resource
  with a `live` flag (real backend vs. demo data).
- [`ProfileScreen.tsx`](../../apps/mobile/src/screens/ProfileScreen.tsx) "Integrations" card:
  renders the honest tri-state per connector — **Connected** (sealed token) / **Connect**
  (configured, not yet connected) / **Planned** (not configured in this deployment) — and a
  "Preview" badge when not live. No fake "Verbunden" toggle anywhere.

## External steps to go live (the actual handback)

### Google Calendar (REQ-010)

1. **Google Cloud project**: create one; enable the **Google Calendar API**.
2. **OAuth consent screen**: external user type; app name/logo/support email;
   scope `https://www.googleapis.com/auth/calendar.readonly` (matches the registry). Note:
   `calendar.readonly` is a **sensitive scope** — Google requires app verification before
   non-test users can grant it; budget the review lead time, and use test users meanwhile.
3. **OAuth client (web application)**: create client id + secret; register the redirect URI
   (the callback route below, on the deployed `AUTH_BASE_URL` origin).
4. **Environment variables**: the code derives the client-id key mechanically —
   `clientIdEnvKey('google-calendar')` →
   **`CONNECTOR_GOOGLE_CALENDAR_CLIENT_ID`** ([`service.ts`](../../apps/api/src/modules/connectors/service.ts)).
   Setting it flips `configured` to true and the UI from "Planned" to "Connect" with no code
   change. The secret is needed only by the (not-yet-built) callback exchange; it should
   follow the same naming (`CONNECTOR_GOOGLE_CALENDAR_CLIENT_SECRET`) and — like all env
   config — be declared in [`apps/api/src/config.ts`](../../apps/api/src/config.ts) when that
   code lands. **`CONNECTOR_MASTER_KEY`** (32 bytes) must be set in the deployment for the
   vault to seal tokens at all.
   (Do not confuse these with the existing `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in
   `config.ts` — those are the *sign-in* social provider, ADR-0018, a separate OAuth app.)

### Apple Calendar

The registry models `apple-calendar` as OAuth against `appleid.apple.com`, but Apple exposes
**no calendar-data OAuth API**: Sign in with Apple grants identity only, and calendar access
is CalDAV (`caldav.icloud.com`) authenticated with the user's Apple ID + an **app-specific
password**, or on-device EventKit in the mobile client. The external part is therefore:
an Apple Developer account (already needed for EAS/store), a product decision between the
CalDAV path (server-side, needs per-user app-specific passwords stored in the vault) and the
EventKit path (client-side, needs device entitlements and an EAS build — same handback class
as [the on-device checklist](../mobile/on-device-checklist.md)). The registry's `oauth2` entry
for Apple should be revisited in that PR — it currently mirrors the other providers' shape as
a placeholder.

### Microsoft (named by REQ-010)

REQ-010 says "Google/Microsoft", but the registry has **no Microsoft/Outlook connector
entry** yet — adding `microsoft-calendar` to `registry.ts` (Graph scope
`Calendars.Read`) plus an Azure app registration (client id/secret, consent) is the same
pattern as Google and is called out here so it is not silently dropped.

## Remaining code once credentials exist

1. **OAuth authorize + callback routes** in the connectors module: a `GET
   /api/connectors/:id/authorize` that redirects via the already-tested `buildAuthorizeUrl`
   (state = CSRF token), and the callback that exchanges code → tokens and stores them with
   `putToken` (vault). Today `buildAuthorizeUrl` has no caller outside its unit tests — this
   is the main missing server piece, and it is credential-testable only.
2. **The concrete adapter implementing `CalendarPort`**: one file,
   **`apps/api/src/modules/calendarsync/google-calendar.ts`** — reads the sealed token via the
   vault, calls the Google Calendar `events.list` API for the range, maps to the neutral
   `ExternalEvent`, confines every Google type to this file, implements `available()` as
   configured + consented + token-present. (Apple equivalent: `apple-calendar.ts`, per the
   decision above.)
3. **Wire `calendarsync` into Nest** (module + provider selection by config/consent, Null as
   default) and give the `automation` module its real ingestion endpoint that surfaces
   `planImport`'s proposals as candidate entries (REQ-010: normalized, never auto-committed).
4. **Token refresh**: the vault stores `refreshToken`/`expiresAt` already; the adapter/vault
   flow needs the refresh exchange once a live provider exists.

## Write-back (REQ-034, #43) — today vs. live API

**Today:** nothing write-shaped exists, deliberately. `CalendarPort` is read-only by
documented contract ("The port only *reads*", [`port.ts`](../../apps/api/src/modules/calendarsync/port.ts));
the registry's `google-calendar` entry has **no `outbound` capability** — only `inbound`
(readonly scope) and `capture` — so `scopesForGrantedCapabilities` can never request a write
scope for it. What *is* already in place is the consent machinery write-back requires:
ADR-0033's per-capability grants mean adding an
`{ capability: 'outbound', scopes: ['https://www.googleapis.com/auth/calendar.events'] }`
entry makes the write scope appear **only** when the user explicitly grants outbound — the
UI copy on the Integrations card already promises exactly that ("export only after
confirmation — never automatic").

**Needs the live API:** everything else — a write surface (either a separate
`CalendarWriteBackPort` or an extension, keeping read paths unaffected), the dedicated
mirror calendar, privacy presets, idempotent upsert keyed on entry identity, and clean
disable/revoke (delete mirrored events, then `DELETE /api/connectors/:id`) can only be
built and verified against a real Google calendar with granted write scope. Re-consenting
users through a second OAuth round (incremental authorization) for the added scope is part
of that live work.
