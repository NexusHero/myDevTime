# ADR 0047: TanStack Query for server-state (non-PowerSync reads)

## Status

Accepted (owner decision) — **supersedes the hand-rolled `useAsync` and the raw
`useState`/`useEffect` fetch hooks** in `apps/mobile`. The offline-first data path
(local SQLite / PowerSync, [ADR-0043](0043-adopt-powersync-for-offline-sync.md)
/ [ADR-0046](0046-drizzle-on-the-client.md)) is **unaffected** — this governs only
server reads that do **not** flow through PowerSync. Bound by
[ADR-0005](0005-deterministic-core-llm-assist.md) (the numbers stay the
deterministic core's).

## Context

The client fetched server data (billing/credits, AI, connectors, catalog) two
ways: a minimal `useAsync(fn, key)` wrapper, and per-hook raw
`useState`/`useEffect` bookkeeping (`useConnectors`, `usePlanner`). Both hand-roll
loading/error/liveness, neither caches or dedupes, and the raw-`useEffect` hooks
are exactly the "tangle" a server-state library exists to remove. There was no
shared client for retries, request dedup, or cache invalidation.

## Decision

1. **Adopt TanStack Query (`@tanstack/react-query` v5)** as the server-state
   manager for non-PowerSync reads. A single `QueryClient` (`makeQueryClient`,
   `retry: 2`, `staleTime: 30s`, `refetchOnWindowFocus: false`) is provided at the
   app root (`app/_layout.tsx`).

2. **`useAsync` becomes a thin adapter over `useQuery`.** Same signature and
   `{ loading, error, data, reload }` shape, so **every caller is untouched**
   (Reports, Credits, Task entries, Catalog), but the engine is now React Query —
   caching, request dedup by key, retries, and no hand-rolled effect.

3. **Raw-`useEffect` fetch hooks move to `useQuery` / `useMutation`.**
   `useConnectors` now loads with `useQuery` and persists consent/disconnect with
   `useMutation` that writes the response into the cache. Its public
   `ConnectorsResource` shape is unchanged.

4. **Scope boundary — PowerSync data does not go through React Query.** Offline
   entities (timers, entries, budgets, reports) come from local SQLite via the
   `packages/local-db` repositories (ADR-0046); React Query is for the
   server-only endpoints. Two data planes, deliberately: local-first for the
   offline core, React Query for the online extras.

5. **Test wiring:** a test-only `TestQueryProvider` (retries off, fresh client per
   render) wraps the render tests whose screens now call `useQuery` (Today via the
   NL quick-add's catalog load; Profile via connectors). ADR-0027's null/demo path
   is otherwise unchanged.

## Consequences

- One server-state manager; the hand-rolled loading/error/liveness code and the
  raw fetch effects are gone. Sibling screens sharing a key issue one request.
- A new dependency (`@tanstack/react-query`), confined to the query hooks + the
  root provider. Bundles cleanly for web (verified: `expo export`, 17 routes).
- Clear rule for future hooks: server read → `useQuery`; server write →
  `useMutation`; offline entity → `packages/local-db`. No new `useEffect` fetches.
- **Deferred:** `usePlanner` still uses raw `useState`/`useEffect`. Its *loads*
  would move to `useQuery` cleanly, but it also carries mutation-heavy plan/apply/
  review/briefing flows whose conversion to `useMutation` deserves on-device
  verification; it is a follow-up, not silently dropped.

## Alternatives considered

- **Keep `useAsync` / raw effects (status quo):** works, but no cache/dedup/retry
  and the `useEffect` tangle remains. Rejected.
- **SWR:** lighter, but no first-class mutations/invalidation and a smaller RN
  story; React Query is the ecosystem standard for RN + web. Rejected.
- **Route everything (incl. offline) through React Query:** would fight the
  offline-first local-SQLite/PowerSync design (ADR-0043/0046) and duplicate its
  cache. Rejected — the two-plane boundary in Decision 4 is deliberate.
