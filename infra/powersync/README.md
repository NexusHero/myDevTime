# Self-hosted PowerSync — deployment (DRAFT)

Self-hosted offline-first sync for the client, per the PowerSync adoption decision
(PR #192). PowerSync is the client sync engine; **our backend keeps conflict
resolution** — a time-entry interval conflict is surfaced, never auto-merged
(REQ-006, realizing the client half of ADR-0019 / ADR-0040).

> **Status: DRAFT.** These files are grounded in PowerSync's self-hosting docs but
> have **not** been booted/validated here. Every item under "Validate before use"
> must be confirmed against the running service and the pinned image version.

## Files

- [`docker-compose.yml`](docker-compose.yml) — the `journeyapps/powersync-service` container.
- [`powersync.yaml`](powersync.yaml) — service config (source Postgres, storage, sync rules, JWT auth).
- [`sync-rules.yaml`](sync-rules.yaml) — one workspace-scoped bucket; every synced row filtered by `workspace_id`.
- [`.env.example`](.env.example) — the environment variables the compose file expects.

## How the pieces fit

```
device (PowerSync SDK, local SQLite)
  │  stream: pull rows for the device's workspace  ◄── sync-rules.yaml
  │  uploadData(): POST the local CRUD queue        ──► our backend  POST /api/sync/upload
  ▼                                                       │  resolveCrudWrite → surface | apply
PowerSync service ── logical replication ──► our app Postgres ◄── persisted by the same adapters
```

- **Reads** flow through PowerSync (source Postgres → service → device SQLite), scoped by the sync
  rules.
- **Writes** do **not** go straight to Postgres: the client connector's `uploadData()` posts the
  queued changes to our own `POST /api/sync/upload`, which applies the deterministic conflict policy
  and persists. This is what keeps "surface durations, never auto-merge" ours.

## Prerequisites

1. **Logical replication** on the source Postgres:
   - `wal_level = logical`
   - a publication PowerSync can subscribe to, e.g. `CREATE PUBLICATION powersync FOR ALL TABLES;`
2. A **separate database** for PowerSync's own storage (`PS_STORAGE_DATABASE_URI`).
3. Our backend exposes a **JWKS endpoint** and mints a short-lived device JWT carrying a
   `workspace_id` claim (the sync-rules parameter) and the `powersync` audience.

## Run

```sh
cp .env.example .env    # fill in the values
docker compose --env-file .env up
```

## Validate before use

- [ ] Confirm the `powersync.yaml` key names + the entrypoint args against the pinned image version.
- [ ] Confirm the sync-rules parameter accessor (`token_parameters.*` vs `request.parameters()`).
- [ ] Pin an explicit `journeyapps/powersync-service` tag (no floating `latest` in prod).
- [ ] Enable TLS (`sslmode`) for the source connection outside a local network.
- [ ] `preferences` is excluded from sync (no `id` column) — decide: add an `id`, or keep it
      device-local.
- [ ] Wire the client connector `uploadData()` to `POST /api/sync/upload` and issue the device JWT.

Client SDK wiring and the cleanup of the retired hand-rolled sync tables are tracked in the
integration issue.
