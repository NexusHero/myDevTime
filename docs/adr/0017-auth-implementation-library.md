# ADR 0017: Authentication Implementation — Better-Auth (focused libraries as fallback)

## Status

Accepted — **Better-Auth**. Realizes the identity/session policy of ADR-0007 and **amends its
session mechanism** (access/refresh JWT → opaque server-side DB sessions); see the status note on
ADR-0007. The owner chose to adopt directly rather than run a de-risking spike first, so the
integration checks move into #4 as blocking acceptance criteria (below).

## Context

ADR-0007 fixed the **policy**: self-hosted (no auth SaaS), email/password + Sign in with
Google & Apple, argon2 hashing, revocable sessions, our own user/session tables behind an
`AuthenticatedUser` boundary. It deliberately did **not** pin the concrete implementation —
"established libraries for password hashing and OIDC client flows" — leaving the library choice
to the M0 auth issue (#4).

Since ADR-0007 was written, the TypeScript auth landscape moved: **Better-Auth** (MIT,
self-hosted, TypeScript-first) matured into a comprehensive framework covering exactly our
policy surface, while the previously-common reference *Lucia* was retired as a library (now a
learning resource only). So the real choice for #4 is now between adopting one auditable
framework and assembling focused primitives ourselves. That is architecturally relevant (a new
core dependency vs. hand-rolled security-critical code), so it gets its own ADR.

Two constraints from our own rules gate the decision and cannot be waived:

1. **Workspace isolation by construction** (CLAUDE.md): every repository API takes a
   `workspace_id` non-optionally, with negative isolation tests. Any auth store we adopt must
   fit this model, not fight it.
2. **Boundary** (ADR-0007): upstream code sees only `AuthenticatedUser`, never provider/token
   mechanics — so the chosen library must be confinable behind the `auth` module's contract.

## Options

### Option B — Better-Auth (chosen)

MIT, self-hosted, official Fastify integration (`auth.api.getSession`, `fromNodeHeaders`),
Drizzle+PostgreSQL adapter, Google & Apple OAuth, email/password with verification & reset,
**database-backed opaque sessions in `httpOnly` cookies with cross-device revocation**, an Expo
plugin (React Native session in `SecureStore`, bearer token, offline cache — REQ-006), and
2FA/passkey + organization/multi-tenancy plugins for later.

- **Pro:** minimal hand-written crypto (the ADR-0007 concern), Apple/Google/verify/reset flows
  out of the box, first-class mobile story, a clear path to post-1.0 2FA/passkeys.
- **Con / risk:** it **generates and owns its DB schema**, and its multi-tenancy is the
  *organization* plugin — both must be reconciled with our `workspace_id` isolation model and
  the `AuthenticatedUser` boundary. It is also young (fast-moving API).

**Session-model note:** Better-Auth's opaque, server-side DB sessions are *not* the
access-JWT + rotating-refresh-token pair ADR-0007 sketched — they are the simpler
instantly-revocable pattern the security literature (RFC 9700) prefers for a modular monolith.
Adopting Better-Auth therefore **amends ADR-0007's session mechanism**, not its policy — the
status note is added to ADR-0007 in this PR.

### Option A — Focused libraries (fallback)

`@node-rs/argon2` (argon2id) + `openid-client` (OpenID-certified) + `@fastify/jwt` +
`@fastify/cookie` + `@fastify/rate-limit`, with our own user/session tables.

- **Pro:** total control, literally matches ADR-0007's wording, stable long-lived building
  blocks, schema fits our isolation model by construction.
- **Con:** we hand-write and must exhaustively test the security-critical parts — refresh-token
  rotation with reuse detection, verify/reset flows, the Apple client-secret JWT, device/session
  management — all inside our own audit scope.

### Rejected (recorded in ADR-0007)

Auth SaaS (Auth0/Clerk/Firebase), heavyweight OSS IdPs (Keycloak/Ory), passwordless-only. Lucia
is additionally rejected as a dependency (retired upstream).

## Decision

**Adopt Better-Auth (Option B).** No standalone de-risking spike (owner decision — accept the
integration risk inside #4). The checks a spike would have front-loaded become **blocking
acceptance criteria for #4**; if any cannot be met, #4 falls back to **Option A** (fully specified
below) and this ADR is superseded rather than silently ignored:

1. Better-Auth's generated schema (users, sessions, accounts) coexists with our `workspaces` root
   and is scoped/queried by `workspace_id` **without breaking the negative isolation tests**.
2. The library stays **confinable behind the `auth` module contract** — nothing upstream imports
   Better-Auth types; upstream sees only `AuthenticatedUser`.
3. Google + Apple + email/password + verify/reset + mobile (Expo/`SecureStore`) all work
   end-to-end on our Fastify + Postgres/Drizzle stack.

#4 implements this test-first (SKILL §). Because the risk is carried in #4 rather than a spike,
the first #4 PR must exercise criteria 1–2 explicitly (isolation + boundary tests) before the
provider flows.

## Consequences

- No standalone spike: #4 carries the Better-Auth integration risk as blocking acceptance
  criteria (owner decision). The focused-libs fallback (Option A) stays documented as the escape
  hatch if #4 proves Better-Auth cannot meet criteria 1–3. (Spike issue #64 closed as folded into
  #4.)
- Non-negotiable, library-independent hardening still applies and is the review checklist for #4:
  argon2id at OWASP parameters, opaque server-side sessions (or refresh rotation + reuse
  detection if Option A), `httpOnly`+`Secure`+`SameSite` cookies with CSRF protection, login
  rate-limiting/backoff, encrypted-at-rest calendar-OAuth tokens (ADR-0007).
- Adopting a framework trades some hand-written code for a young dependency; the `auth`-module
  boundary keeps a later migration possible, exactly as ADR-0007 intended for the SaaS case.
