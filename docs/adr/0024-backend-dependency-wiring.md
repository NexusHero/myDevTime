# ADR 0024: Backend Dependency Wiring — Manual Constructor Injection + Fastify Plugins (DI-container adoption gated on a spike)

## Status

**Accepted** for the current wiring (it is what the backend does today) — with the separate
question **"should we adopt a DI container?"** left **Proposed, gated on spike
[#104](https://github.com/NexusHero/myDevTime/issues/104)** ([brief](../spikes/0002-di-container.md)).
Realizes the composition half of ADR-0003/0015 (Fastify modular monolith); does not change any
module's public surface.

## Context

The backend (`apps/api`) wires dependencies with **plain factory functions**: each module is
`xModule(deps): FastifyPlugin` taking a typed `{ db, config }`, and `buildApp` constructs the deps
once and passes them in as it registers each module under its prefix. Cross-cutting concerns use
**Fastify's own plugin system** — `fastify-plugin` + `decorate` (e.g. `auth` decorates
`requireAuth` at the root), and per-plugin **encapsulation** gives each module its boundary. There
is **no DI container** and **no `reflect-metadata`**.

This has been frictionless so far, but two forces make "do we want a container?" a real question:

- **A growing adapter surface.** Ports & adapters (process skill §2.2) mean one narrow interface
  each for LLM, ASR, Stripe, StoreKit, Play Billing, and calendar SDKs. Each adds a real
  implementation plus a faked one for tests — more wiring to thread through `buildApp`.
- **DIP as a merge gate.** SOLID/DIP is enforced in review; we satisfy it today by depending on
  **narrow interfaces passed explicitly**, not a container. Whether a container would make that
  cleaner (or just add ceremony) is unproven either way.

Any answer must respect three hard constraints: **TypeScript `strict`** (+ `exactOptionalPropertyTypes`)
with **no `reflect-metadata`/decorator metadata**, **Fastify's encapsulation/lifecycle** (request
scope, `onClose`), and the **deterministic-core purity rule** (`packages/domain` is pure functions —
nothing to inject there, ever).

## Decision

1. **Manual constructor injection + Fastify plugin/decorator composition is the default wiring.**
   Modules stay factory functions over a typed `deps` object; `buildApp` is the single composition
   root; Fastify `decorate`/`fastify-plugin` carries cross-cutting dependencies. No container, no
   `reflect-metadata`, by default.
2. **DIP is satisfied by narrow ports, not a container.** Volatile vendors sit behind one interface
   each (`PaymentProviderPort`, `TranscriptionPort`, …); the concrete adapter is passed in
   explicitly at the edge. This is unchanged by this ADR.
3. **Adopting a DI container is deferred to spike [#104](https://github.com/NexusHero/myDevTime/issues/104).**
   The spike decides go/no-go with evidence (ergonomics at ~8 modules, Fastify fit, TS-strict
   friendliness without decorators, testability, cost). If it says GO, a **decorator-free,
   TS-first container (Awilix is the lead candidate)** may be introduced behind the same module
   boundaries. **Decorator/`reflect-metadata` containers (NestJS DI, InversifyJS, TypeDI) are
   pre-rejected** — they conflict with the no-decorator-metadata constraint.

## Alternatives considered

- **A decorator-based DI container now (NestJS/Inversify/TypeDI):** the "batteries-included" path,
  but it requires `reflect-metadata` and decorator metadata, adds framework weight, and would sit
  awkwardly beside Fastify's own lifecycle. Rejected against the constraints.
- **Manual wiring forever, no spike:** cheapest, and correct *today* — but "does this still hold at
  scale?" is exactly the open question, so we frame it as a spike rather than assert an answer.
- **Service-locator via Fastify `decorate` only, for everything:** already used for genuinely
  cross-cutting decorations (`requireAuth`), but as a *general* DI answer it hides dependencies
  behind the instance and weakens the explicit, typed `deps` contract. Kept for cross-cutting, not
  promoted to the general mechanism.

## Consequences

- No code changes land with this ADR — it records the status quo and opens the evaluation.
- The ports & adapters rule remains the DIP mechanism regardless of the spike's outcome, so a
  future container is an *implementation detail of the composition root*, not a change to module
  contracts.
- The stack stays on `strict` with no decorator metadata unless spike #104 explicitly clears a
  container that keeps that property.
- Tech Radar gains a **"DI container — Assess (spike #104)"** entry so the open question stays
  visible.
