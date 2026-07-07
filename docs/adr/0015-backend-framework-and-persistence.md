# ADR 0015: Backend Framework & Persistence — Fastify + PostgreSQL + Drizzle

## Status

Accepted

## Context

ADR-0003 fixed the backend as a Node.js/TypeScript **modular monolith** (`auth`,
`tracking`, `sync`, `automation`, `ai`, `billing`) but deliberately left the
concrete framework, ORM, and database open until the skeleton lands (issue #3).
Those choices are now needed. The forces: a solo-sustained project (one runtime,
minimal moving parts), TypeScript `strict` end to end, module boundaries that are
enforced rather than aspirational (SKILL §2.1), OpenAPI generated from route
definitions (not hand-maintained), and a deterministic core that stays pure
(ADR-0005) with I/O confined to the edges.

## Decision

- **HTTP framework: Fastify.** Its **plugin encapsulation** maps directly onto
  the modular-monolith boundary — each module is an encapsulated plugin with its
  own scope, registered under a prefix in one wiring file. Schema-first routes
  (via Zod + `fastify-type-provider-zod`) give request/response validation and
  **OpenAPI generation for free** (`@fastify/swagger`). Pino logging is built in.
- **Database: PostgreSQL.** The product's data (workspaces, entries, budgets,
  entitlements, transcripts) is relational with strong integrity needs; Postgres
  is the boring, correct default and every hosting target supports it.
- **ORM/migrations: Drizzle.** TypeScript-first, SQL-close (no query-language
  abstraction to fight), typed schema, lightweight SQL migrations checked into
  the repo via `drizzle-kit` — no heavy codegen step in the build.
- **Config: Zod-validated environment** at boot (12-factor). No endpoints, keys,
  or model names as literals; `.env` is gitignored, `.env.example` is committed.
- **Errors: RFC 7807 `application/problem+json`.** Typed domain errors are
  mapped to problem responses in one Fastify error handler; internals never leak.
- **Module boundaries enforced by a test:** a deterministic check fails the build
  if a module imports another module's internals. Modules may depend only on
  another module's `contract.ts` (interfaces/types); wiring lives in `app.ts`.
- **Health:** `/health` (liveness, no I/O) and `/health/ready` (readiness, pings
  the DB). Readiness integration tests run against a real Postgres — a container
  locally, a service container in CI — and skip when `DATABASE_URL` is unset so
  the pure local gate stays runnable without a database.

## Alternatives considered

- **NestJS:** first-class modules out of the box, but a heavy decorator/DI
  framework is more surface than a solo project needs; Fastify's plugin scoping
  achieves the same boundary with far less machinery (and Nest can run on
  Fastify later if DI is ever wanted).
- **Express:** ubiquitous but unopinionated, no schema/OpenAPI story, weaker TS
  types — more glue to hand-write.
- **Prisma:** mature, but its own query engine + codegen add a build step and an
  abstraction layer; Drizzle stays closer to SQL and to the "deterministic,
  inspectable" ethos. Prisma remains a viable supersede if Drizzle's ergonomics
  disappoint at scale.
- **SQLite/Turso** for dev speed: rejected as the primary store — parity with the
  production database matters more than local convenience, and Postgres runs
  fine in a container.

## Consequences

- Each module is an encapsulated Fastify plugin exposing a narrow contract; new
  behavior is a new plugin + one registration line (OCP), and the boundary test
  keeps the seams honest.
- OpenAPI is a generated artifact (`pnpm --filter @mydevtime/api openapi:emit`),
  uploaded by CI — it can never silently drift from the routes.
- Integration tests need a Postgres; CI gains a `postgres` service and the local
  gate stays DB-free (readiness tests self-skip without `DATABASE_URL`). A
  `docker compose` file provides a local database for those who want the full run.
- Vendor surface stays confined: the `pg`/Drizzle client lives behind the `db`
  module; domain logic (`packages/domain`) never imports it (ADR-0005).
- This ADR realizes ADR-0003; it does not supersede it.
