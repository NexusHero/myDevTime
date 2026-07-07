# ADR 0014: Monorepo Toolchain — pnpm Workspaces, Vitest, ESLint Flat + Prettier

## Status

Accepted

## Context

Issue #2 bootstraps the repository as the TypeScript monorepo that ADR-0003
(Node/TS backend) and ADR-0004 (TS client) both live in, so backend, clients,
and the pure domain packages share one toolchain and one set of domain types.
This is the first line of real code, and the process (SKILL §1.2) requires a
technology choice to be recorded as an ADR. The concrete tools — package
manager, test runner, linter/formatter — are exactly such choices, and their
job is to make the SKILL's gates (strict TS §2.4, TDD/coverage §3, the local
gate §5, docs-staleness §1.5) executable rather than aspirational.

## Decision

- **Package manager: pnpm workspaces.** Fast, disk-efficient, strict
  `node_modules` (a package can only import what it declares), first-class
  workspace support. Layout: `apps/*`, `packages/*`; `spikes/*` are
  deliberately outside the workspace (throwaway prototypes with their own
  toolchains).
- **Language config: one `tsconfig.base.json`** with `strict` plus
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `isolatedModules`, `noImplicit*`, unused-locals —
  extended per package. ESM + `NodeNext` throughout.
- **Test runner: Vitest** with the v8 coverage provider. The **≥90% coverage
  gate (SKILL §3.4) is enforced on `packages/domain`** — the pure deterministic
  core (ADR-0005) — and turned on per-package as other packages gain real
  logic. Test names follow `Subject_StateUnderTest_ExpectedBehaviour`.
- **Lint/format: ESLint flat config with `typescript-eslint`
  strict-type-checked + stylistic-type-checked, and Prettier** for formatting.
  Type-aware rules run only on package/app source (files that live in a
  tsconfig); root config and scripts get the plain recommended rules. Prettier
  owns code formatting; **Markdown is excluded** (it pads hand-aligned tables
  and fights the arc42/ADR prose) — docs integrity is covered by the
  staleness gate instead.
- **One local gate = CI:** `./test.sh` runs format-check → lint → typecheck →
  tests+coverage → docs-staleness, and the GitHub Actions workflow runs the
  same script. **Git hooks** (`core.hooksPath = scripts/hooks`, wired by the
  `prepare` script) run the gate on `pre-commit` and enforce Conventional
  Commits on `commit-msg`.
- **Client-stack gate honored:** `apps/mobile` is a README-only placeholder —
  no client code until ADR-0004 is Accepted via spike #1.

## Alternatives considered

- **npm/Yarn workspaces:** npm workspaces are clunkier for a growing monorepo;
  pnpm's strict resolution catches phantom-dependency bugs the others hide.
- **Jest:** heavier config and slower ESM/TS story than Vitest for a
  TS-first, esbuild-based repo.
- **Nx/Turborepo:** valuable at scale, but task-graph caching is premature for
  a handful of packages and adds a moving part a solo project would maintain.
  The `pnpm -r` scripts leave the door open to adopt one later.
- **Biome** (lint+format in one) was tempting for speed, but `typescript-eslint`
  type-checked rules (which need real type information) are the point of §2.4,
  and Biome does not yet match them.

## Consequences

- Every gate is executable and demonstrably catches its failure mode: a
  non-conventional commit subject, a dead docs link, and a sub-90% coverage
  gap each fail locally and in CI.
- Internal packages currently build to `dist/` and export from it; when the
  first cross-package consumer lands (#3/#7) it either consumes `dist` or the
  repo adopts TS project references / a source-condition — decided then, not
  pre-optimized now.
- Concrete backend **framework, ORM, and database** are explicitly *not*
  decided here — they are ADR material for issue #3 (backend skeleton), which
  takes the next free ADR number.
- The `pnpm-lock.yaml` is committed; CI installs with `--frozen-lockfile` so a
  drifted lockfile fails fast.
