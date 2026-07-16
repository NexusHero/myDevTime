# ADR 0040: Offline-First Local Store as the Sync Client (realizes ADR-0019 on the device)

## Status

**Superseded by [ADR-0049](0049-abandon-offline-first-architecture.md)** — offline-first is abandoned: the
local store was removed and the app is online-only. The original decision is kept below for the record.

Accepted (owner decision) — **extends [ADR-0019](0019-sync-protocol.md)** (cross-device sync) and is
bound by [ADR-0005](0005-deterministic-core-llm-assist.md) (deterministic core). Supersedes the
offline-only approach proposed in PR #172 (its draft offline-SQLite ADR), which is reworked under the
epic #174 (slices #175–#177).

> Numbering note: 0037–0039 are reserved for the in-flight PRs #172/#173; this decision takes 0040
> to avoid a collision while those PRs are open.

## Context

We want one codebase to serve two modes without forking either the schema or the math:

1. **Standalone offline apps** (iOS/Android/Web) that work from first launch — no account, no
   backend, no internet — the way Toggl Track works out of the box.
2. **Server-backed, team-scale collaboration** when a server is present — multiple devices and,
   later, multiple users on a shared workspace (the "Atlassian-scale" direction).

ADR-0019 already chose the mechanism for (2): **server-authoritative delta sync with per-entity
optimistic versioning and a deterministic per-entity conflict policy in `packages/domain`**, and the
engine exists and is tested (`packages/domain/src/sync/`). What was missing is the **client half** —
a local store the device reads/writes offline and reconciles later.

PR #172 built that store but as a *parallel world*: it recomputed report/worktime/billing numbers in
SQL (fabricating money at a hardcoded €100/h and a hardcoded 40 h week), dropped `workspace_id` /
`version` / `deleted_at` ("single-user device, Phase 2 concern"), and shipped no tests. Those columns
are load-bearing for ADR-0019, and recomputing numbers on the client contradicts ADR-0005 (offline
and online then disagree for identical data). That approach is a dead end that would force an
on-device data migration the day teams land.

## Decision

The offline local store is the **client realization of ADR-0019**, not a new architecture. Three
rules make standalone and team the *same* code:

1. **One schema, two modes.** The local store (SQLite via `expo-sqlite` on native, `wa-sqlite` on
   web) mirrors the server schema **including the sync/tenancy columns** on every syncable entity:
   `workspace_id`, `version`, `updated_at`, `deleted_at`, `device_id`, `operation_id`.
   - **Standalone** = sync **off**, a synthetic local `workspace_id`, no account.
   - **Team** = sync **on**, real workspace(s), server authoritative (ADR-0019).
   There is **no schema fork** between the two — turning sync on is a switch, not a migration.

2. **Compute lives in `packages/domain`, run on both client and server.** The local store is a
   **thin repository** (rows in/out) with **no aggregation, no money/time math**. Every figure the
   client shows offline is produced by the *same* pure `packages/domain` functions the API uses
   (`buildTimesheet`, worktime coverage, reporting summary, budgets, credits). Offline == online **by
   construction** — a client never recomputes a number in SQL and never hardcodes a rate or target
   (ADR-0005).

3. **Workspace-scoped by construction.** Repository APIs take a `workspace_id` non-optionally, even
   for the standalone synthetic workspace, and each entity carries negative isolation tests — the
   non-negotiable isolation rule holds in the local store exactly as on the server.

Vendor SQLite drivers are confined to one adapter each (`expo-sqlite` / `wa-sqlite`) behind a narrow
port; nothing upstream imports their types (ports & adapters). Conflict resolution during sync stays
the existing `packages/domain` per-entity policy — LWW for catalog metadata; **time-entry interval
conflicts are surfaced, never auto-merged** (ADR-0019).

## Consequences

- The app works fully offline from first launch, and the *same* build scales to team sync by enabling
  the ADR-0019 engine — no rewrite, no schema migration on device.
- Offline and online numbers cannot drift, because there is one calculator (`packages/domain`).
- Slightly more upfront cost than "offline-only": the sync/tenancy columns and a local change-log are
  carried from day one, even for users who never go online. That is the price of not repaving the
  foundation later — the right trade for a product whose thesis is trustworthy numbers.
- Delivery is sliced under #174: repository + schema (#175), domain-computed hooks (#176), sync
  wiring (#177). Each ships gate-green with tests.

## Alternatives considered

- **Offline-only local store (PR #172 as written):** rejected — dead-ends at single-device, forks the
  compute (ADR-0005 violation), and forces an on-device migration when teams arrive.
- **Thin client, server-authoritative only (no real local writes):** rejected — REQ-006 requires
  offline periods "measured in days," which a read-through cache cannot serve.
- **CRDTs (Automerge/Yjs) for everything:** rejected for the money-bearing entities — automatic merge
  of a duration is exactly what ADR-0019 forbids; CRDTs remain an option scoped to genuinely
  co-edited free text (e.g. shared notes) only.
- **Sync-as-a-platform (ElectricSQL / PowerSync / WatermelonDB):** not adopted now; worth a
  time-boxed spike (tracked in #177) **only** if a platform can honour "surface duration conflicts,
  don't auto-merge." Until proven, the hand-rolled, fully-tested ADR-0019 resolver stays.
