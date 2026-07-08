# ADR 0018: Social Providers (Google + Apple + GitHub) and the Auth-Edge Boundary

## Status

Accepted — extends ADR-0007's provider list and records how far Better-Auth
(ADR-0017) is hidden. Delivered by #4.

## Context

ADR-0007 fixed email/password + **Google + Apple** as the launch identity
providers. Two questions surfaced while implementing the auth module (#4):

1. **Which social providers?** The audience is developers/freelancers (22–45).
   For them **GitHub** is a more natural login than Facebook; Facebook is
   declining for this segment, needs a business app-review for the email scope,
   and carries heavier (Meta) data-processing weight. The owner chose to **add
   GitHub and drop Facebook**.
2. **How much of Better-Auth do we hide?** ADR-0007's boundary rule says upstream
   sees only `AuthenticatedUser`. Better-Auth also ships a co-designed client
   SDK/Expo plugin and its own `/api/auth/*` wire protocol. Do we wrap those
   behind our own facade endpoints + client, or expose them directly?

## Decision

**Providers:** email/password + **Google + Apple + GitHub**, with account
linking (one internal user id, many linked providers — already the ADR-0007
model). Each provider is enabled only when its `*_CLIENT_ID`/`*_CLIENT_SECRET`
are configured, so the app runs with any subset. **Facebook is rejected** for
the reasons above; it can be added later without structural change.

**Auth-edge boundary — hide internally, do *not* over-hide at the client edge:**

- **Internally (server): fully hidden.** Better-Auth is confined to the `auth`
  module (`auth-instance.ts`, `index.ts`); no other module imports Better-Auth
  types — enforced by `confinement.test.ts`. Upstream sees only
  `AuthenticatedUser`. Which provider authenticated is invisible upstream.
- **At the HTTP/client edge: exposed on purpose.** Better-Auth owns `/api/auth/*`
  and the client uses its SDK / Expo plugin. We deliberately **do not** wrap
  these behind our own RFC-7807 facade. Better-Auth's server and client are a
  co-designed vertical (session cookies, CSRF, OAuth state, refresh, SecureStore
  on mobile); re-wrapping it would re-introduce exactly the security-critical,
  hand-rolled surface we adopted a framework to avoid, and would lag upstream.
  The cost of that abstraction exceeds the migration-insurance benefit.

Consequence for API consistency: the auth endpoints speak Better-Auth's wire
format, while the rest of the API stays RFC-7807. We accept and document that
seam rather than hide it. `/api/auth/me` is our own thin, documented route that
maps a session to `AuthenticatedUser` — the pattern the rest of the app uses.

## Consequences

- Migration insurance is **right-sized**: a future move off Better-Auth touches
  the `auth` module + the client's auth layer, not the whole codebase — exactly
  what ADR-0017's boundary intends.
- Apple App Store guideline 4.8 stays satisfied (Sign in with Apple is present
  alongside Google/GitHub).
- Three providers = three sets of credentials + data-processing agreements to
  keep; the config makes each independently optional so environments enable only
  what they have.
- The documented wire-format seam at `/api/auth/*` is a known, intentional
  exception to the RFC-7807 rule, not an oversight.
