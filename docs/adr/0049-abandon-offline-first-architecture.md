# ADR 0049: Abandon the offline-first architecture (online-only)

## Status

Accepted (owner decision) — **supersedes the offline-first line: ADR-0040
(local store as sync client), ADR-0042 (offline money path), ADR-0043 (PowerSync),
and ADR-0046 (Drizzle on the client)**. The deterministic core
([ADR-0005](0005-deterministic-core-llm-assist.md)) and the server tracking/billing
modules are untouched; this only removes the *client* offline stack and the server
`sync` module that existed to serve it.

## Context

We adopted an offline-first client (ADR-0040/0042/0043/0046): a local SQLite
store (`@mydevtime/local-db`), a second data path in every hook, offline money
computed in the core, and PowerSync as the sync transport. In practice the cost
outran the value for the MVP:

- Every data hook carried a **dual online/offline branch**, roughly doubling its
  surface and its failure modes.
- Keeping the local schema, its migrations, and the sync/conflict story in parity
  with the server was ongoing overhead.
- Testing the client meant mocking SQLite/`localStorage` persistence on top of the
  render tests.
- Offline was a *nice-to-have*, not a 1.0 requirement — the architectural weight
  was disproportionate.

Separately, to validate the simplified client against the real backend, we wanted
a one-command local production-like environment.

## Decision

1. **Online-only client.** Remove `@mydevtime/local-db` and the client's
   `src/localDb/*`; each data hook now talks straight to the API, or falls back to
   the clearly-labeled **demo** path when no API URL is configured (unchanged).
   Server state is managed by TanStack Query ([ADR-0047](0047-tanstack-query-server-state.md)).
2. **Remove the server `sync` module** and its PowerSync device-token/JWKS
   endpoints (`SyncModule`, `powersync-auth`, `jose`); the pure conflict engine in
   `packages/domain/src/sync/*` and the server `sync` tables are left dormant in
   place (no destructive migration) as the documented re-entry point should
   offline ever return.
3. **Keep the installable PWA app-shell** ([#199](https://github.com/NexusHero/myDevTime/issues/199)):
   the service worker caches the *shell*, which is orthogonal to offline *data*.
4. **Local production-like env.** Dockerfiles for the API (`node:22-alpine`,
   migrate-on-start) and the web build (`nginx:alpine`, static + `/api` proxy),
   orchestrated by `docker-compose` (Postgres + Redis + api + web); `pnpm docker`.

## Consequences

- **Pros:** large drop in client complexity and bundle size; a single data path;
  standard HTTP mocking in tests; a clean `docker compose` test environment.
- **Cons:** the app needs a network (and a configured `EXPO_PUBLIC_API_URL`) to
  show real data — **a native/web build without a backend is now the demo app**,
  not a persistent one. Optimistic UI that the local store gave "for free" is now
  TanStack Query's responsibility ([ADR-0047](0047-tanstack-query-server-state.md)).
- **Correction to an earlier draft:** `wa-sqlite`/`@powersync/react-native` were
  never actually installed (PowerSync-web proved incompatible with Metro, #193), so
  there was nothing to uninstall there; what is removed is `expo-sqlite`,
  `@mydevtime/local-db`, `jose`, and the `sync` module.
