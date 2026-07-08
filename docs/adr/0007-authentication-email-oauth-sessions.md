# ADR 0007: Authentication — Email/Password + Google & Apple Sign-In, Token Sessions

## Status

Accepted — session mechanism amended by [ADR-0017](0017-auth-implementation-library.md): the
"short access token + rotating refresh token" pair below is realized as **opaque server-side
database sessions** (Better-Auth), which keep the same policy (short-lived, revocable, device
list) with instant cross-device revocation. Identity, providers, and hardening are unchanged.

## Context

Every rail needs auth from day one (ADR-0002): sync, billing, and calendar integration are all
account-bound. Constraints: (1) Apple's App Store guideline 4.8 — an app offering third-party
login must also offer Sign in with Apple, and Google sign-in is effectively mandatory anyway
because Google Calendar OAuth (ADR-0002's auto-capture) uses the same identity; (2) mobile apps
need long-lived, revocable sessions that survive offline periods (offline-first, REQ-006);
(3) a solo project should not hand-roll crypto, but also should not weld its user table to a
third-party identity SaaS on day one.

## Decision

- **Identity:** email/password (with verification) plus **Sign in with Google** and **Sign in
  with Apple** as OAuth providers at launch. Accounts are keyed by a stable internal user id;
  provider identities and calendar-OAuth grants link to it (one user, multiple linked providers).
- **Sessions:** short-lived access token + long-lived rotating refresh token, stored in secure
  platform storage on mobile and `httpOnly` cookies on web; refresh tokens are revocable
  server-side (device list / logout-everywhere).
- **Implementation:** a self-hosted, library-based auth module inside the Node backend
  (ADR-0003) — established libraries for password hashing (argon2) and OIDC client flows, our own
  user/session tables. The auth module is a boundary: the rest of the codebase sees only
  `AuthenticatedUser`, never provider or token mechanics.
- Standard hardening is in scope from the first issue: login rate limiting, verification +
  password-reset flows, account deletion (store-policy and DSGVO requirement).

## Alternatives considered

- **Auth SaaS (Auth0/Clerk/Firebase Auth):** fastest start, but per-MAU pricing, vendor lock on
  the user table, and the calendar-OAuth grants need our own token storage anyway. The auth-module
  boundary keeps a later migration possible if maintenance cost proves too high.
- **Self-contained OSS IdP (Keycloak/Ory):** operationally heavy for a solo-run product.
- **Passwordless-only (magic links):** clean, but hostile as the *only* factor on mobile and
  unfamiliar to part of the audience; magic links can be added later without structural change.

## Consequences

- Store-compliance is satisfied by construction (Apple 4.8), and Google Calendar connection reuses
  the Google identity flow instead of a second consent journey.
- Owning user/session tables means owning their security: the security checklist (process skill
  §4) applies to every auth endpoint, and the M0 auth issue carries explicit abuse-case tests.
- 2FA/passkeys are deliberately post-1.0 backlog — the session and account model above does not
  block adding them.
- Calendar OAuth tokens (read scope) are stored encrypted at rest and are revocable per
  integration, independent of login sessions.
