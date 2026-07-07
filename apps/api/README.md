# @mydevtime/api

Node.js + TypeScript backend, a **modular monolith on Fastify**
([ADR-0003](../../docs/adr/0003-node-typescript-backend.md),
[ADR-0015](../../docs/adr/0015-backend-framework-and-persistence.md)).

## Structure

Each business module is an **encapsulated Fastify plugin** registered under its
own prefix in [`src/app.ts`](src/app.ts) — the boundary from ADR-0003:

| Module | Prefix | Delivers |
|--------|--------|----------|
| `auth` | `/api/auth` | authentication & sessions (REQ-002, #4/#5) |
| `tracking` | `/api/tracking` | entries, projects, attendance, budgets (M1) |
| `sync` | `/api/sync` | offline-first cross-device sync (REQ-006, #9) |
| `automation` | `/api/automation` | calendar ingestion + rules engine (M3) |
| `ai` | `/api/ai` | LLM/ASR assist — proposals only (ADR-0005, M3) |
| `billing` | `/api/billing` | entitlements + credit ledger (ADR-0006/0008, M4) |

Modules depend only on another module's `contract.ts`; a
[boundary test](src/modules/boundaries.test.ts) fails the build on any internal
cross-import. Cross-cutting operational routes (`/health`, `/health/ready`) live
outside the business modules.

## Run it

```bash
cp apps/api/.env.example apps/api/.env      # then edit as needed
docker compose up -d                        # local Postgres (ADR-0015)
pnpm --filter @mydevtime/api db:migrate      # apply migrations
pnpm --filter @mydevtime/api dev             # http://localhost:3000
```

- `GET /health` — liveness · `GET /health/ready` — readiness (pings the DB)
- OpenAPI: `pnpm --filter @mydevtime/api openapi:emit` (CI publishes it as an artifact)
- Errors are RFC 7807 `application/problem+json`, mapped in one handler
  ([`src/errors.ts`](src/errors.ts) + `src/app.ts`).

Config is validated from the environment at boot ([`src/config.ts`](src/config.ts));
never put endpoints/keys/model names in source (SKILL §2.3).
