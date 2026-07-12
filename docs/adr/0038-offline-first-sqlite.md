# ADR 0038: Offline-First SQLite Persistence (Phase 1)

## Status

Accepted — introduces a new package `@mydevtime/local-db`.

## Context

myDevTime's mobile app currently operates in two modes:

1. **Demo mode** (`EXPO_PUBLIC_API_URL` unset): Hooks return hardcoded illustrative data. The app renders but nothing is persisted — every restart resets state.
2. **Live mode** (`EXPO_PUBLIC_API_URL` set): Hooks call the REST API which persists data in a PostgreSQL database. Requires a running backend server.

Neither mode serves a user who wants to use the app immediately, offline, on a single device — the way Toggl Track works out of the box. Asking end users to provision PostgreSQL or run Docker is not viable for a consumer product.

The architecture already has the perfect seam for this: every hook checks `apiBaseUrl === null` and branches to demo data. We replace the demo branch with real SQLite queries, yielding a fully functional offline app with zero backend dependency.

## Decision

1. **New package `packages/local-db`**: A platform-agnostic persistence layer using `expo-sqlite` (which works on iOS, Android, and Web via IndexedDB fallback). It contains:
   - `client.ts` — Database open + schema creation.
   - `entries.ts` — CRUD for time entries (the timer core).
   - `catalog.ts` — CRUD for projects, tasks, clients, tags.
   - `planner.ts` — CRUD for day plans.
   - `index.ts` — Public API.

2. **Schema mirrors PostgreSQL**: The local SQLite tables use the same column names and types as the server-side PostgreSQL schema, but simplified:
   - No `workspace_id` or `user_id` foreign keys (single-user device).
   - TEXT primary keys with client-generated UUIDs.
   - ISO-8601 TEXT columns for timestamps (no `timestamptz`).
   - No `version`/`deleted_at` sync columns (Phase 2 concern).

3. **Hook rewiring**: Each hook's `if (base === null)` branch changes from `Promise.resolve(demoData)` to a SQLite query. The live API path (`base !== null`) is completely untouched.

4. **React Context for DB handle**: A `LocalDbProvider` wraps the app and provides the SQLite handle via `useLocalDb()`. The database is opened once at app startup.

## Consequences

- `expo-sqlite` becomes a dependency of `apps/mobile`.
- The app works fully offline from first launch — no account, no backend, no internet required.
- All existing tests remain green: test code runs without `EXPO_PUBLIC_API_URL`, so hooks still follow the `base === null` path. The SQLite layer is tested independently.
- Phase 2 (cloud sync) can be added later by reading the sync columns (`version`, `deleted_at`) that already exist in the server-side schema (ADR-0019).
