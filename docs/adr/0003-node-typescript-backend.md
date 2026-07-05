# ADR 0003: Node.js/TypeScript Backend as a Modular Monolith

## Status

Accepted

## Context

myDevTime needs a backend for auth, sync, calendar ingestion, the rules/AI layer, and billing
webhooks. It is a one-person project (for now): one runtime, one deployment, one CI pipeline is
what a solo developer can sustain. Unlike the sibling project Finanzo — which chose .NET because
its hardest integration (ERiC, a native C library) is first-class there — myDevTime has no such
native-library constraint. Its integration surface is HTTP APIs throughout: Google/Microsoft
calendar APIs, LLM providers, Stripe, App Store/Play Store server notifications. The client stack
(ADR-0004) is TypeScript-based, so a TypeScript backend gives one language, one toolchain, and
shared domain types (time-entry math, budget calculations, validation schemas) across the whole
product — the strongest argument for Node here.

## Decision

A single **Node.js + TypeScript** backend, built as a **modular monolith**: clear in-process
module boundaries (`auth`, `tracking`, `sync`, `automation`, `ai`, `billing`) that communicate
through interfaces, one deployable unit. TypeScript `strict` project-wide. Volatile third-party
surfaces (LLM SDKs, Stripe SDK, calendar SDKs) are each confined to a single adapter file behind a
narrow interface, per the process skill §2.2. Framework/ORM/database specifics are decided in
their own ADRs when the bootstrap issue lands.

## Alternatives considered

- **C#/.NET modular monolith (Finanzo's choice):** excellent, but sacrifices the shared-types
  advantage with the TypeScript client and adds a second language to a solo project for no
  offsetting integration win.
- **Microservices from the start:** operational overhead a one-person team cannot sustain; the
  modular-monolith seams keep later extraction possible.
- **Backend-as-a-Service (Firebase/Supabase only):** fastest to demo, but the rules engine,
  billing entitlements, and AI orchestration are real server-side domain logic that would end up
  in cloud functions anyway — with worse testability than a proper monolith.

## Consequences

- One language end to end: domain logic (time math, budget/rate calculations, categorization
  rules) can live in shared packages, written once, tested once, used by client and server.
- The Node ecosystem's weaker compile-time guarantees vs .NET are mitigated by TypeScript
  `strict`, the ≥90 % coverage gate on core logic, and keeping business logic in pure,
  dependency-free modules.
- Extraction seams exist if one module ever needs to scale independently (likely candidate: the
  calendar-ingestion worker), but nothing is extracted preemptively.
- Concrete framework, ORM, and database choices are follow-up ADRs tied to the bootstrap issue —
  this ADR fixes runtime and language, not the whole stack.
