# ADR 0028: REST (resource endpoints) as the client↔server API style, not GraphQL

## Status

Accepted — makes explicit the API-style dimension that ADR-0003/0015/0025 assumed but never
weighed against GraphQL. No technology changes; it records the _why_ so the question does not get
re-litigated informally.

## Context

The backend (ADR-0025) exposes resource endpoints: NestJS controllers, `nestjs-zod` for
validation and generated OpenAPI, RFC 7807 (`problem+json`) errors, a Better-Auth session guard.
The client (ADR-0004) talks to them through a thin typed seam (`http.ts` → `getJson`/`postJson`,
problem→`ApiError` mapping) that assembles fixed, designed screens. GraphQL was never explicitly
considered; the recurring question — "the requests are related and stateful, so why not GraphQL?"
— deserves a recorded answer rather than a verbal one.

The forces that actually shape this API:

- **Deterministic core owns the truth (ADR-0005).** Every timesheet/budget/export number is
  computed by pure logic server-side and returned whole; clients render it, they do not compose
  it. Invariants (e.g. "≤ 1 running timer per workspace") are enforced by the DB + transactions,
  not the caller.
- **The relatedness we have is temporal/protocolar, not data-graph-shaped.** The timer lifecycle
  (`start → running → stop`) is an ordered sequence of atomic mutations; cross-device **sync**
  (ADR-0019) is a cursor-based delta conversation. Neither is "fetch a nested read graph in one
  round-trip" — the one thing GraphQL is built to make elegant.
- **One schema source already pays for itself.** Zod schemas feed validation _and_ OpenAPI _and_
  client types from a single definition; 7807 gives errors HTTP-status semantics for free.
- **Payments are HTTP by nature.** The Stripe webhook (raw body + signature) is a REST endpoint
  regardless of the rest of the API — a GraphQL API would be hybrid anyway.
- **Small team.** Operational surface (query-depth/complexity limits, N+1/DataLoader batching, a
  second codegen toolchain) is a real cost, not a rounding error.

## Decision

**Keep a RESTful resource-endpoint API as the single client↔server style.** Model behaviour as
resources and actions (`POST /api/tracking/entries/timer/start`, `GET …/running`, …), validated by
Zod/`nestjs-zod`, erroring as RFC 7807, guarded by Better-Auth. When a screen needs a composed
read, add a **purpose-built aggregate/read endpoint** (a server-owned view) rather than reaching
for GraphQL.

## Alternatives considered

- **GraphQL (e.g. NestJS + Mercurius, Fastify-native).** Technically compatible with ADR-0025.
  Rejected as net-negative _for this system_: its headline wins (client-side field selection,
  nested read graphs in one round-trip) address a relatedness we largely do not have, while its
  costs land squarely on us — a second type system alongside Zod→OpenAPI, re-implementing the 7807
  error contract and HTTP-status/caching semantics inside a single `200` `errors[]` channel, and
  the ops surface above. Philosophically it also pushes composition _up to the client_, the
  opposite of this codebase's "server owns the truth, client is dumb" center of gravity.
- **tRPC.** Tight TS end-to-end types without SDL. Rejected: coupling the RN client to backend TS
  types cuts against the versioned, OpenAPI-documented boundary (ADR-0016 publishes the spec), and
  it buys little over the existing typed `http` seam.
- **A REST aggregate/BFF read endpoint for the drill-down.** _Adopted as the escape hatch, not a
  replacement._ The genuine GraphQL upside — collapsing the Projects → project → task → entries
  reads (today three calls + `assembleCatalog`) into one — is recovered with a single view
  endpoint, keeping Zod/OpenAPI/7807/caching intact.

## Consequences

- **Enables:** one schema→validation→OpenAPI→client-types pipeline; standard HTTP semantics
  (status codes, conditional/`GET` caching, idempotency); a stable, documented, versionable
  contract for a client that ships through app stores; the smallest possible client seam
  (`getJson`/`postJson` + parsers), because the server enforces every invariant.
- **Costs / accepts:** over-/under-fetching is handled by designing per-screen DTOs and, where a
  read is graph-shaped, an explicit aggregate endpoint — deliberate work rather than a generic
  query language. Multiple round-trips for unrelated reads are accepted (they parallelise).
- **Forecloses (reversibly):** should a future need appear — many divergent third-party clients,
  or deep ad-hoc graph reads — a **read-only GraphQL/BFF facade** can be added _additively_ over
  the same pure domain core without changing it. This ADR does not preclude that; it declines to
  pay for it now.
