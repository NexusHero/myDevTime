# Contributing

Thanks for taking the time to contribute!

This project follows the [Ultimate Development Process](skills/ultimate-dev-process/SKILL.md) — a
process merged from two sibling projects (ElliotWaveAnalyzer, Résumé/myJob), adopted here via the
sibling project Finanzo ([ADR-0001](docs/adr/0001-adopt-ultimate-development-process.md)). It
covers architecture governance, implementation style, testing behavior, and commit/PR workflow in
one place. Read that skill first; this file only pins down the parts specific to this repo.

## Ways of working

- **We merge only via Pull Request — no direct pushes to `main`.** `main` is protected.
- One logical change per PR. For larger changes, open an issue first to discuss the approach.
- Every PR must be green on all CI checks and have its review threads resolved before merge.
- **Every task gets a GitHub issue, and every PR links it** (`Closes #123`).
- **Every technology choice or architecture decision gets an ADR, in the same PR** — see
  [`docs/adr/README.md`](docs/adr/README.md).

## Setup

pnpm-workspace TypeScript monorepo ([ADR-0003](docs/adr/0003-node-typescript-backend.md),
[ADR-0014](docs/adr/0014-monorepo-toolchain.md)). Requirements: **Node ≥ 22, pnpm ≥ 10**
(`corepack enable`).

```bash
pnpm install     # installs deps AND wires the git hooks (core.hooksPath)
./test.sh        # the local gate — exactly what CI runs
```

The gate runs, in order: build packages → `format:check` → `lint` → `typecheck` → `coverage` →
`check:purity` → `check:docs` → `check:req-coverage` → `check:adherence`. Individual commands (`pnpm lint`,
`pnpm test`, `pnpm coverage`, `pnpm typecheck`, `pnpm check:docs`, `pnpm build`) and the full
gate table are in
[`skills/ultimate-dev-process/SKILL.md`](skills/ultimate-dev-process/SKILL.md) → Appendix.

Layout: `apps/api` (NestJS backend), `apps/mobile` (Expo/React-Native client — iOS/Android/Web),
`packages/domain` (pure deterministic core, held to ≥ 90 % coverage), `packages/shared`
(types/schemas), `packages/design` (design tokens + theme + nav model, held to the coverage bar).
`spikes/*` and `e2e/` are outside the workspace (throwaway prototypes; the Playwright acceptance
suite).

Git hooks are automatic after `pnpm install`: `pre-commit` runs the gate, `commit-msg` enforces
Conventional Commits. Bypass in a real emergency with `git commit --no-verify`.

## Running the whole thing locally

The fast gate (`./test.sh`) proves the code; the **Docker stack** proves the thing we ship. The
same images CI builds run on your machine via a `Makefile` — no hand-wiring, no clicking through
sign-in to check the app boots.

```bash
make up          # build + start Postgres · Redis · api · web (nginx) — web on http://localhost:8080
make smoke       # black-box HTTP checks against the running stack (ADR-0052)
make down        # stop and wipe volumes
```

Browser **acceptance** tests (ADR-0053) drive the built web app through Chromium against that
stack — they prove the app mounts and a real user can sign in, automatically:

```bash
make acceptance  # bring up the E2E overlay, install Playwright, run e2e/tests/*.spec.ts
# or, against a stack you already started with `make up-e2e`:
make e2e-install # once
make e2e
```

The E2E overlay (`docker-compose.e2e.yml`) turns email verification **off** so a seeded account
can sign in immediately — allowed only because `NODE_ENV=development`; a config refine forbids
`AUTH_REQUIRE_EMAIL_VERIFICATION=false` in production. `make help` lists every target.

Every requirement in the register maps to its verifying tests in
[`docs/testing/requirements-traceability.md`](docs/testing/requirements-traceability.md),
enforced by `pnpm check:req-coverage` in the gate.

## Branching & commits

```bash
git switch -c feat/short-description     # or fix/, docs/, chore/, refactor/, test/, ci/
# ... work, commit ...
git push -u origin feat/short-description
# open a PR against main
```

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) in English:

```
feat(api): add pagination to GET /time-entries
fix(timer): stop double-counting overlapping entries
docs(adr): record the billing-provider decision
```

Types: `feat` · `fix` · `docs` · `test` · `refactor` · `chore` · `ci` · `build` · `perf` ·
`style` · `revert`.

## Tests

New logic ships with a test written before the implementation (TDD — see the process skill §3).
Name tests `Subject_StateUnderTest_ExpectedBehaviour` and follow Arrange–Act–Assert. Target
**≥ 90%** coverage on core/business logic (time math, budgets, rates, rule engine), achieved by
keeping that logic pure and dependency-free.

## Documentation

Architecture is documented arc42-style in [`docs/architecture.md`](docs/architecture.md). Keep the
Requirements Register, Quality Goals, and Runtime View current — see the process skill §1. The
milestone plan lives in [`docs/roadmap.md`](docs/roadmap.md).

## Questions?

Open a Discussion or ask in the issue thread.
