# ADR 0019: Cross-Device Sync Protocol — Server-Authoritative Delta Sync with a Deterministic Per-Entity Conflict Policy

## Status

Accepted

## Context

REQ-006 requires synchronizing a workspace across phone, tablet, and web with
**offline periods measured in days, not seconds** — offline-first is core
architecture, not a retrofit (ADR-0002/0003, the `sync` module). Issue #9 asks
that the protocol be chosen and recorded as an ADR before the engine is built.
(The issue text says "ADR-0009"; that number was already taken by the
meeting-capture decision, so this is **ADR-0019** — the number is corrected, the
requirement is the same.)

The forces are specific and, in one place, unusual:

- **Deterministic core (ADR-0005):** every number that reaches a timesheet is
  computed by pure, exhaustively tested logic in `packages/domain`. Whatever
  resolves a sync conflict on a *duration* is such a number — it must be pure and
  deterministic, not buried in a vendor library.
- **Time entries must never be silently merged into wrong durations** (REQ-006,
  REQ-004). This inverts the usual sync goal: for the money-bearing field we
  explicitly *do not want* automatic convergence — a conflict a rule can't settle
  must **surface to the user**, not be quietly averaged away.
- **Single-writer-per-workspace at 1.0.** One workspace has one owner (REQ-001);
  "concurrent edits" are the *same person* on two devices, not collaborators
  co-editing. True multi-user real-time collaboration is out of scope for 1.0.
- **Record-oriented data**, not rich text: workspaces, clients, projects, tasks,
  tags, time entries — discrete rows with clear ownership and small field sets.
- **Solo-sustained, minimal moving parts** (the ADR-0015 ethos): prefer the
  boring, inspectable mechanism over machinery we can't fully test.
- **Postgres + Drizzle** on the server (ADR-0015); the client-side local store is
  gated on the cross-platform spike (#1), so this ADR fixes the *protocol and
  conflict semantics*, which both halves must honor, not the client storage tech.

## Decision

**Server-authoritative delta sync with per-entity optimistic versioning and a
deterministic, per-entity-type conflict policy that lives in `packages/domain`.**
Concretely:

- **The server is the source of truth.** Every syncable row carries a
  server-assigned **monotonic version** within its workspace (a per-workspace
  change sequence) plus `updatedAt` and the originating `deviceId`. Clients keep a
  **watermark** (the highest version they have pulled).
- **Delta pull / push changelog.** A client *pulls* all changes with
  `version > watermark` (workspace-scoped), and *pushes* its local changes, each
  tagged with the **base version** it last saw for that entity and a stable,
  client-generated **operation id**.
- **Optimistic concurrency detects conflicts.** On push, if the server's current
  version for an entity is newer than the client's base version, the two edits
  conflict; otherwise the write applies and bumps the version. Detection is
  mechanical and server-side; **resolution is delegated to a pure function** in
  `packages/domain` keyed by entity type:
  - **Catalog entities** (clients, projects, tasks, tags): **field-level
    last-writer-wins**, deterministic tie-break by `(updatedAt, deviceId)`. Losing
    a rename or colour change is low-harm and recoverable, so these converge
    automatically.
  - **Time entries** (the money): fields that don't touch the interval (`note`,
    `billable`, `tags`) field-merge; **any divergence on `startedAt`/`endedAt`, or
    a delete-vs-edit, is NOT auto-resolved** — it is recorded as a **surfaced
    conflict** (the losing version is preserved, both are shown, the user picks).
    No rule ever silently rewrites a duration.
- **Deletions are tombstones.** A delete sets `deletedAt` and bumps the version so
  it syncs like any change; rows are hard-purged only after all devices are known
  past that version. Archived state is an ordinary field and syncs the same way.
- **Idempotent and resumable.** The server upserts by `(entityId, operationId)`,
  so a re-delivered push is a no-op; a pull is a pure function of the watermark.
  An interrupted sync resumes from the last acked version — a partial failure
  never leaves local state corrupt, because a push is only acked after it commits.
- **The running timer is just an entity.** Start-on-phone / stop-on-web needs no
  special path: the running row (`endedAt IS NULL`) syncs like any other. The
  one-running-timer-per-workspace invariant stays **server-enforced** (the partial
  unique index from #8); if two devices start a timer while both offline, the
  second to sync loses the insert and its start is surfaced as a conflict per the
  time-entry policy — never silently dropped.
- **Transport is incremental.** 1.0 uses plain HTTP push/pull (periodic + on
  foreground); offline-first does not require real-time. A realtime nudge
  (SSE/WebSocket "something changed, pull now") can be layered later **without
  changing the protocol semantics**, so it is explicitly deferred, not designed in
  now.

```mermaid
sequenceDiagram
    participant D as Device (offline for days)
    participant S as sync module (server)
    D->>S: POST /sync/push { changes:[{entityId, opId, baseVersion, fields}], watermark }
    S->>S: per entity — baseVersion current? apply : resolve(entityType, local, incoming)
    S-->>D: { applied, conflicts:[surfaced], newWatermark }
    D->>S: GET /sync/pull?since=watermark
    S-->>D: { changes:[version > watermark], watermark }
    D->>D: apply pulled changes; present surfaced conflicts to the user
```

## Alternatives considered

- **CRDT library (Yjs / Automerge).** The strongest option *if* the goal were
  automatic convergence of collaboratively edited documents. It is the wrong tool
  here for two decisive reasons: (1) CRDTs are built to **auto-merge** — precisely
  what we must not do to a time-entry duration; bending a CRDT to *surface* a
  duration conflict fights its whole design. (2) The merge semantics would live in
  a third-party library, not in `packages/domain`, breaking the "every timesheet
  number is pure, inspectable, exhaustively tested" rule (ADR-0005). Plus metadata
  overhead and a heavy dependency for data that is record-oriented and
  single-writer. Kept on the radar as **Assess/Hold**: revisit only if true
  multi-user real-time collaboration ever enters scope.
- **Pure op-log / event-sourcing sync with no server authority.** Elegant and
  fully resumable, but cross-device operation ordering and idempotency become the
  hard problem, and reconstructing current state from a log complicates the
  Postgres-relational model (ADR-0015). Server-authoritative versioning gives the
  same resumability with a current-state table that is trivial to query and
  reason about.
- **Naïve whole-entity last-writer-wins for everything.** Simplest, but it
  violates REQ-006 outright — a stale device would silently overwrite corrected
  minutes. Rejected: LWW is acceptable *only* for low-harm catalog metadata, never
  for the interval of a time entry.

## Consequences

- **The conflict policy is testable core.** Resolution is a pure function
  `resolve(entityType, local, incoming) → { winner, surfaced? }` in
  `packages/domain`, held to the ≥90 % bar and driven by the simulation tests in
  #9 Phase 2 (two devices + server, scripted interleavings, property-based
  convergence) — no I/O needed to prove convergence and "no lost/duplicated
  minutes."
- **`sync` becomes a real module** (ADR-0003): two endpoints (`/sync/push`,
  `/sync/pull`), workspace-scoped like every other repository API, with the
  version/tombstone columns added to the synced tables via a Drizzle migration.
- **A surfaced-conflict surface is now required downstream.** The client (post-#1)
  and the UX (Day Canvas / review) must show and let the user resolve time-entry
  conflicts — this ADR creates that obligation; the UI is specified where those
  features land, not here.
- **Scope is honestly bounded:** this decides the protocol and semantics only. The
  engine, schema, and tests are #9 Phase 2; the on-device store and its offline
  queue follow the client spike (#1). REQ-006 stays *Proposed* until Phase 2
  lands.
- **This ADR realizes the `sync` module named in ADR-0003; it does not supersede
  any prior ADR.**
