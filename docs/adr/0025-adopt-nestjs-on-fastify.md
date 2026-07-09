# ADR 0025: Adopt NestJS (on the Fastify adapter) for the backend

## Status

**Accepted — by explicit owner decision.** Supersedes the composition/DI half of
**ADR-0003** and **ADR-0015** (the backend is now a NestJS application, not a hand-wired Fastify
modular monolith), supersedes **ADR-0024** (manual constructor injection), and **resolves spike
[#104](https://github.com/NexusHero/myDevTime/issues/104)** in favour of a container — the owner
chose NestJS's decorator-based DI over the decorator-free candidates the spike had framed.

Fastify is **kept** as the HTTP layer (`@nestjs/platform-fastify`), so ADR-0015's Fastify + Postgres
+ Drizzle + RFC 7807 + Zod-OpenAPI choices survive in substance; only the composition model changes.

## Context

ADR-0024 recorded manual constructor injection + Fastify plugins and opened spike #104 to evaluate a
DI container. The owner decided directly for **NestJS** — its module/provider/controller structure,
first-class DI, guards/interceptors/pipes, and ecosystem — accepting the one constraint it forces:
NestJS DI reads constructor parameter types from **decorator metadata** (`reflect-metadata` +
`emitDecoratorMetadata`), which CLAUDE.md's "no `reflect-metadata`" rule had excluded. That rule is
**relaxed for `apps/api` only**; the pure packages (`packages/*`) keep `strict` with no decorator
metadata.

## Decision

- **NestJS 11 on `@nestjs/platform-fastify`.** `NestFactory.create(AppModule.forRoot(deps), new FastifyAdapter(...))`.
  Fastify remains the server + logger; Nest owns modules, DI, and lifecycle.
- **Composition root = `AppModule.forRoot({ config, db })`.** A `@Global` `CoreModule` provides the
  former `deps` object as injection tokens (`CONFIG`, `DB`, `DB_HANDLE`); feature modules
  `@Inject(...)` them. The `postgres`/Drizzle driver stays confined to the `db` module (ADR-0015);
  `packages/domain` is never injected — it is pure and called directly (ADR-0005 unchanged).
- **DIP via provider tokens.** Ports (`PaymentProviderPort`, `TranscriptionPort`, …) become Nest
  injection tokens with `@Inject`; the concrete adapter is bound in the module. DIP is preserved,
  the mechanism is the container.
- **Validation + OpenAPI = `nestjs-zod`.** The `@mydevtime/shared`/Zod schemas stay the single
  source: `ZodValidationPipe` for requests, `createZodDto` + patched Swagger for OpenAPI. No
  class-validator DTOs.
- **RFC 7807 via one exception filter** (`ProblemDetailsFilter`) — typed `AppError`s keep their
  status/title/detail; `HttpException`s (incl. nestjs-zod 400s) map to a problem; anything else is a
  logged 500. Preserves ADR-0015's error convention.
- **Auth = a Nest `AuthGuard`** over the confined Better-Auth instance (ADR-0017); Better-Auth still
  owns `/api/auth/*` and its types stay inside the module.
- **Toolchain:** `apps/api/tsconfig` enables `experimentalDecorators` + `emitDecoratorMetadata` and
  disables `verbatimModuleSyntax` (incompatible with metadata emission); the runtime build is `tsc`
  (emits metadata); **Vitest gains an SWC transform** so tests get the same metadata (esbuild does
  not emit it) — verified not to change the pure-package suites. ESLint disables
  `no-extraneous-class` for `apps/api` (Nest's decorator-only classes are legitimate).

## Alternatives considered

- **Keep manual DI (ADR-0024) / a decorator-free container (Awilix, spike #104):** the evidence-first
  path, but the owner chose NestJS directly for structure + ecosystem. Recorded, not taken.
- **NestJS on Express:** the Nest default, but it discards Fastify and its performance; rejected in
  favour of `platform-fastify`.
- **class-validator DTOs:** idiomatic Nest, but it would abandon the shared Zod schemas; rejected for
  `nestjs-zod`.

## Consequences

- `apps/api` is rewritten module-by-module into Nest modules/controllers/providers; `packages/domain`,
  `packages/design`, `packages/shared`, and `apps/mobile` are untouched (the domain stays pure and
  framework-free — the load-bearing invariant).
- `reflect-metadata`/decorator metadata is now allowed in `apps/api` (only). CLAUDE.md's rule is
  amended to scope "no decorator metadata" to `packages/*`.
- Bundle/dep weight grows (Nest + rxjs + reflect-metadata); accepted for the structure/ecosystem gain.
- Tech Radar: NestJS = Adopt; the "DI container — Assess" line (ADR-0024) is resolved to NestJS DI.
