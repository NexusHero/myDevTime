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

The gate runs, in order: `format:check` → `lint` → `typecheck` → `coverage` → `check:docs`.
Individual commands (`pnpm lint`, `pnpm test`, `pnpm coverage`, `pnpm typecheck`,
`pnpm check:docs`, `pnpm build`) and the full gate table are in
[`skills/ultimate-dev-process/SKILL.md`](skills/ultimate-dev-process/SKILL.md) → Appendix.

Layout: `apps/api` (backend — skeleton in [#3](https://github.com/NexusHero/myDevTime/issues/3)),
`apps/mobile` (**gated on spike #1** — README only, no client code yet), `packages/domain`
(pure deterministic core, held to ≥ 90 % coverage), `packages/shared` (types/schemas).
`spikes/*` are throwaway prototypes outside the workspace.

Git hooks are automatic after `pnpm install`: `pre-commit` runs the gate, `commit-msg` enforces
Conventional Commits. Bypass in a real emergency with `git commit --no-verify`.

## Branching & commits

```bash
git switch -c feat/short-description     # or fix/, docs/, chore/, refactor/, test/, ci/
# ... work, commit ...
git rebase origin/main                    # rebase before merge (not merge commit)
git push -u origin feat/short-description
# open a PR against main
# merge via GitHub: "Rebase and merge" (never "Create merge commit")
```

### Commit message strategy

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) in English,
with professional structure for public visibility (GitHub releases, team communication):

**Subject line (max 70 chars):**
```
feat(scope): clear, imperative title (Issue #X, ADR-Y)
```

**Types:** `feat` · `fix` · `docs` · `test` · `refactor` · `chore` · `ci` · `build` · `perf` ·
`style` · `revert`.

**Scopes:** `api` (backend), `mobile` (RN/Expo app), `design` (tokens/components), `domain`
(core logic), `shared` (types/schemas), `ci` (pipeline), etc.

**For major features (Tier 1):**
Include a detailed body with rationale and risks:

```
feat(api): migrate to NestJS modular monolith (#3, ADR-0025)

Replace Fastify app.ts with Nest bootstrap. Add DI container configuration,
provider setup, RFC 7807 exception filter, and health endpoint with OpenAPI.

Supports fine-grained module architecture (auth, tracking, sync, billing) with
dependency injection and better testability via @nestjs/testing.

Risk: All endpoints must re-integrate under Nest controllers. Phased approach
mitigates: #102 tracks controller ports one by one.

Closes #3, refs ADR-0025
```

**For bug fixes or smaller changes (Tier 2 & 3):**
Keep it concise:

```
fix(timer): stop double-counting overlapping entries (#87)
docs(adr): record the billing-provider decision
chore: upgrade pnpm to v10
```

### Merge strategy: Rebase + Fast-Forward

- Always `git rebase origin/main` before pushing (keeps linear history)
- Merge via GitHub: select **"Rebase and merge"** (creates one clean line, no merge commits)
- Result: Clean, linear `main` branch readable as a story from top to bottom

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
