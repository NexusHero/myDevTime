# ADR 0043: Adopt PowerSync for Offline-First Sync

## Status

Accepted (owner decision) — **supersedes the _client half_ of [ADR-0019](0019-sync-protocol.md) and the
hand-rolled client store/sync of [ADR-0040](0040-offline-first-local-store-as-sync-client.md)**. The
deterministic conflict policy in `packages/domain` and the offline compute of
[ADR-0042](0042-offline-money-path-in-the-core.md) are **retained**; bound by
[ADR-0005](0005-deterministic-core-llm-assist.md).

## Context

ADR-0019 chose server-authoritative delta sync with a deterministic, conflict-surfacing policy, and
ADR-0040 realized the **client** of that as a hand-rolled store: a local SQLite change-log
(`sync_outbox`), a watermark/device table (`sync_state`), and a `runSync` push/pull orchestrator over
a transport port (delivered as #174 slices, PRs #188 merged and #189 open).

After a build-vs-buy review of the sync platforms (PowerSync, ElectricSQL, WatermelonDB, CRDT
engines), the owner decided to **adopt PowerSync** rather than continue maintaining the hand-rolled
client engine. The deciding facts:

- **PowerSync's model fits our non-negotiable.** It is server-authoritative: the client writes to a
  local SQLite and an **upload queue**, and a developer-defined `uploadData()` uploads those writes to
  **our** backend, where **we** apply the conflict policy. Conflict resolution is *our* backend's job
  (LWW only if we do nothing) — so we keep "**time-entry interval conflicts are surfaced, never
  auto-merged**" (REQ-006).
- **It offloads the hard, ongoing parts** we would otherwise grow and maintain by hand: efficient
  partial replication ("buckets"), streaming pull, connection management, retry/backoff, resumable
  checkpoints, and schema evolution.
- **The alternatives don't fit or cost more.** ElectricSQL pivoted (2024) to **read-path sync only** —
  writes go through your own API, so it would replace only our pull, not the conflict engine.
  WatermelonDB is a full RN ORM with LWW-leaning sync (a large migration against the grain). CRDT
  engines auto-merge durations — exactly what ADR-0019/0040 forbid.

This reverses the "keep hand-rolled now, PowerSync as the scale-up escape hatch" recommendation in
favour of adopting the platform now. The sunk cost of #188/#189 is acknowledged and bounded — the
*valuable* piece (the deterministic conflict engine) is retained (see Decision 2).

## Decision

1. **Client local DB + sync = PowerSync.** The device uses the PowerSync SDK's managed SQLite plus its
   upload queue, streaming pull, and checkpoints. This replaces the direct `expo-sqlite` sync plumbing
   and the hand-rolled `sync_outbox` / `sync_state` / `runSync` / `applyServerChange`.

2. **Writes flow through our deterministic conflict engine.** PowerSync's `uploadData()` uploads the
   local mutation queue to our backend write endpoint, which applies each change through the
   **existing** `packages/domain` sync engine (`resolve` / `applyPush`). The interval-conflict policy
   is unchanged — only the transport/queue is now PowerSync's. The engine and its convergence tests
   stay as-is (they are pure and vendor-free, ADR-0005).

3. **Backend connects PowerSync to Postgres with workspace-scoped sync rules.** Sync rules filter
   every synced row by `workspace_id`, so workspace isolation holds by construction — the same
   non-negotiable as everywhere else, now enforced in the sync-rules layer plus the write endpoint.

4. **Retained unchanged:** `packages/domain` (all money/time/reporting math **and** the sync
   conflict engine); the ADR-0042 offline money/reports compute (it now reads PowerSync-managed SQLite
   rows instead of our own); provenance; workspace isolation; ADR-0005 determinism. Standalone /
   offline-only (no account) still runs on the local SQLite with sync disabled — the one-schema,
   two-modes principle of ADR-0040 is preserved, now via PowerSync's schema.

5. **Retired:** the hand-rolled client sync mechanism — `sync_outbox`, `sync_state`, `runSync`,
   `syncMapping.applyServerChange` (from #188/#189). PR #189 is closed unmerged; #188's tables and
   repos are removed during the PowerSync integration.

6. **Vendor confinement (ports & adapters).** The PowerSync SDK lives behind the existing `LocalDb`
   port / a thin adapter, so nothing upstream imports vendor types and the render-test suite keeps
   running on the null/demo path (ADR-0027). Hosting (PowerSync Cloud vs the self-hosted
   open-source service) is decided in the integration spike; self-hosting is preferred where
   data-residency matters (privacy stance).

## Consequences

- A new external dependency (the PowerSync SDK + service) and its sync-rules DSL + hosting enter the
  stack — the accepted trade for not maintaining a sync engine by hand as we scale toward team use.
- Part of the just-built client sync (#188/#189) is retired; the deterministic conflict engine is kept
  as the backend write handler, so the correctness-critical logic and its tests survive the pivot.
- Offline == online still holds: the same `packages/domain` functions compute every number over the
  local rows, whoever manages them (ADR-0005/0042 unaffected).
- The convergence guarantee ("no lost or duplicated minutes", surfaced interval conflicts) now rests
  on our backend write endpoint reusing the engine — the integration must test that end-to-end.

## Alternatives considered

- **Keep the hand-rolled ADR-0019 client (status quo):** works and fits the constraint, but we own the
  engine and its scaling concerns forever. Rejected in favour of buying a maintained platform.
- **ElectricSQL:** since its 2024 pivot it does **read-path sync only**; writes go through your own
  API. It would replace our pull but not the write/conflict engine — insufficient alone.
- **WatermelonDB:** RN SQLite ORM with LWW-leaning sync you back yourself; a large migration onto a new
  ORM, and conflict-surfacing is against its grain.
- **CRDT engines (Yjs / Automerge / Turso CRDT):** auto-merge durations — forbidden by REQ-006.
