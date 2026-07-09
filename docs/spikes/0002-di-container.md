# Spike #104 — DI container vs. manual constructor injection (backend)

**Issue:** [#104](https://github.com/NexusHero/myDevTime/issues/104) · **Decides:**
[ADR-0024](../adr/0024-backend-dependency-wiring.md) · **Milestone:** cross-cutting
(backend architecture) · **Status: PLANNED — not yet executed**

> This is the spike **brief**. Findings + the GO/NO-GO verdict land here once the spike runs
> (mirroring [spike #1](0001-client-rn-expo.md), whose brief was its issue and whose findings
> filled its doc). ADR-0024 records the current wiring and gates the container question on this.

## Verdict — _pending_

## The question

The backend wires dependencies with **plain factory functions** (`xModule(deps): FastifyPlugin`,
composed once in `buildApp`) plus **Fastify's plugin/decorator system** for cross-cutting concerns —
**no DI container, no `reflect-metadata`** (ADR-0024). As the ports/adapters surface grows (LLM,
ASR, Stripe, StoreKit, Play Billing, calendar SDKs — one narrow interface each, real + faked),
would a **decorator-free, TS-first DI container** reduce wiring cost **without** fighting Fastify's
encapsulation, TypeScript `strict` (no decorator metadata), or the deterministic-core purity rule?

Go/no-go on evidence, not preference.

## Questions (each needs an answer with evidence)

1. **Ergonomics at scale** — real boilerplate reduction at ~8 modules × several adapters, or just
   moved into registration code?
2. **Fastify fit** — composes with per-plugin encapsulation and lifecycle (request scope,
   `onClose`), or introduces a competing service-locator lifecycle?
3. **TS strict, no decorators** — fully typed under `strict` + `exactOptionalPropertyTypes`
   **without** `reflect-metadata`?
4. **Testability** — resolving a module with faked ports simpler or harder than passing `deps`
   today?
5. **Cost** — startup/registration overhead, dependency weight, concept-onboarding cost.

## Candidates

- **Manual constructor injection (status quo)** — the baseline to beat.
- **Awilix** — container without decorators, TS-friendly; primary candidate.
- **A tiny hand-rolled typed composition root** — object graph built once, no library.
- **Rejected up front:** decorator/`reflect-metadata` containers (NestJS DI, InversifyJS, TypeDI) —
  conflict with the no-decorator-metadata constraint.

## Method

Scaffold `spikes/di-container/` wiring the same 2–3 representative modules (one DB dep, one adapter
port, one cross-cutting decorator) **both ways** — status quo and the top container candidate —
behind identical Fastify registration, each with a faked-adapter test. Machine-checkable parts
(typecheck, tests, wiring LOC, startup timing) reproducible via `npm run verify`; judgement parts
written up as findings below.

## Exit criteria (Definition of Done)

- [ ] `spikes/di-container/` scaffold: both wirings, `strict` typecheck clean, faked-adapter tests
      green, `npm run verify`.
- [ ] Findings + **GO/NO-GO** here, with evidence per question above.
- [ ] ADR-0024 amended/resolved with the outcome; Tech Radar ring for "DI container" moved off
      **Assess**.

## Findings

_TBD — populated when the spike runs._
