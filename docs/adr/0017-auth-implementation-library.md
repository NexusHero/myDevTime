# ADR 0017: Authentication Implementation — Better-Auth (pending spike) vs. Focused Libraries

## Status

Proposed — decision frame fixed; winner confirmed by spike #64 before any auth code lands.
Realizes the identity/session policy of ADR-0007 (which stays Accepted and unchanged).

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

### Option B — Better-Auth (recommended, pending spike)

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
Adopting Better-Auth therefore **amends ADR-0007's session mechanism** (via a status note on
0007 in the implementing PR), not its policy.

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

**Adopt Better-Auth (Option B) *if and only if* spike #64 proves it composes cleanly with**
workspace isolation and the `AuthenticatedUser` boundary. The spike's exit criteria:

1. Its generated schema (users, sessions, accounts) coexists with our `workspaces` root and can
   be scoped/queried by `workspace_id` without breaking negative isolation tests.
2. The whole library stays confinable behind the `auth` module contract (nothing upstream imports
   Better-Auth types).
3. Google + Apple + email/password + verify/reset + mobile (Expo/SecureStore) all work end-to-end
   against our Fastify + Postgres/Drizzle stack.

If any criterion fails, fall back to **Option A**. Either way #4 implements the winner test-first
(SKILL §), and this ADR moves to Accepted recording which won.

## Consequences

- One short spike (#64) precedes #4; #4 is unblocked either way (fallback is fully specified).
- Non-negotiable, library-independent hardening still applies and is the review checklist for #4:
  argon2id at OWASP parameters, opaque server-side sessions (or refresh rotation + reuse
  detection if Option A), `httpOnly`+`Secure`+`SameSite` cookies with CSRF protection, login
  rate-limiting/backoff, encrypted-at-rest calendar-OAuth tokens (ADR-0007).
- Adopting a framework trades some hand-written code for a young dependency; the `auth`-module
  boundary keeps a later migration possible, exactly as ADR-0007 intended for the SaaS case.
