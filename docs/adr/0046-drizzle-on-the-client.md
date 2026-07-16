# ADR 0046: Drizzle on the Client (typed local queries over the LocalDb port)

## Status

**Superseded by [ADR-0049](0049-abandon-offline-first-architecture.md)** — offline-first is abandoned: the
client SQLite store (`packages/local-db`) was removed, so Drizzle-on-the-client no longer exists. The
original decision is kept below for the record.

Accepted (owner decision) — **supersedes the hand-written raw-SQL queries** in
`packages/local-db` (the repositories of [ADR-0040](0040-offline-first-local-store-as-sync-client.md)).
The `LocalDb` port, the runtime DDL (`SCHEMA_SQL` / `ensureSchema`), workspace
isolation, and the "store does no math" rule are all **retained**. Extends
[ADR-0015](0015-backend-framework-and-persistence.md) (Drizzle on the server) to the
client; bound by [ADR-0005](0005-deterministic-core-llm-assist.md).

## Context

The backend queries Postgres through Drizzle (ADR-0015), but the client
(`packages/local-db`) queried SQLite through **hand-written SQL strings** plus a
manual row→entity mapper (`toEntry`, `toProject`, …) per repository. That
asymmetry reads as unfinished to anyone moving from the server code to the client,
and the mappers are boilerplate that can silently drift from the columns.

(For the record: the raw SQL was **not** a correctness or lint problem — the
repositories were fully typed via the `LocalDb` port's `Row = Record<string,
SqlValue>` with explicit mappers, no `any`, no suppressions, gate green. This ADR
is a **consistency / maintainability** change, not a bug fix.)

Drizzle is also the query layer PowerSync (ADR-0043) integrates with
(`@powersync/drizzle-driver`), so a Drizzle schema on the client is reused, not
thrown away, when the PowerSync client work lands.

## Decision

1. **Repositories query through Drizzle.** `tables.ts` declares the SQLite schema
   with `drizzle-orm/sqlite-core` (booleans as `{ mode: 'boolean' }`, JSON as
   `{ mode: 'json' }`, enum-ish columns `.$type<…>()`); each repository builds its
   queries with the Drizzle query builder and a typed column **projection** in
   place of the old `SELECT` string + row mapper. Row types now come from the
   schema, so `toEntry`/`toProject`/… are gone.

2. **Drizzle runs over the existing `LocalDb` port via `sqlite-proxy`.** `db.ts`
   wraps the port in Drizzle's async `sqlite-proxy` driver (memoised per port).
   Drizzle generates the SQL; our port executes it. So **nothing new couples to a
   vendor SQLite driver** — no `drizzle-orm/expo-sqlite`, no native dependency in
   the package — the same code runs on iOS, Android **and** web (the port already
   abstracts `expo-sqlite` / `wa-sqlite` / `node:sqlite`), and the render-test null
   path (ADR-0027) is untouched.

3. **The DDL stays in `SCHEMA_SQL` / `ensureSchema`.** `sqlite-proxy` executes
   queries, it does not create tables, so the runtime `CREATE TABLE` remains the
   source of truth for the physical schema. `tables.ts` is the **typed query**
   layer over that same schema — two definitions, guarded by `tables.test.ts`,
   which asserts every Drizzle column exists in the DDL so the two cannot drift.

4. **Retained unchanged:** the `LocalDb` port and its adapters; `SCHEMA_SQL`;
   every repository's public function signatures (they still take `LocalDb` +
   `workspaceId`) and exported `Local*` shapes, so **no caller in `apps/mobile`
   changed**; workspace isolation (the negative isolation tests pass as-is);
   provenance; the "store does no math — `packages/domain` computes every number"
   rule (ADR-0005).

## Consequences

- One query style across server and client; the hand-written `SELECT`/`INSERT`
  strings and manual row mappers in `packages/local-db` are gone.
- A new dependency (`drizzle-orm`) enters the client, confined to `tables.ts` /
  `db.ts` and the repositories. It is pure JS and bundles cleanly for web
  (verified: `expo export --platform web`, 17 routes) and native.
- Two schema definitions (Drizzle tables + `SCHEMA_SQL`) now coexist; the drift
  test makes that safe rather than a hazard.
- The Drizzle schema is the on-ramp for PowerSync's `@powersync/drizzle-driver`
  when the client sync work (issue #193) lands — this is not throwaway.
- `apps/mobile/src/localDb/reports.ts` still holds aggregation SQL (`SUM` /
  `GROUP BY`); it is **out of scope** here (raw aggregation reads clearly and is a
  separate file) and can move to Drizzle later if wanted.

## Alternatives considered

- **`drizzle-orm/expo-sqlite` driver:** the "native" Drizzle path, but it couples
  the package to `expo-sqlite` (breaking the `LocalDb` port and the render-test
  null path) and raises a web-compatibility question. `sqlite-proxy` over the
  existing port avoids both. Rejected.
- **Keep raw SQL (status quo):** typed and correct, but the server/client
  asymmetry and the boilerplate mappers remain. Rejected on consistency grounds.
- **Kysely:** a fine type-safe builder, but the server already runs Drizzle
  (ADR-0015) and PowerSync integrates with Drizzle — one tool wins on both counts.
