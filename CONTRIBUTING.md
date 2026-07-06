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

The backend stack is Node.js/TypeScript ([ADR-0003](docs/adr/0003-node-typescript-backend.md));
the client stack is proposed as React Native + Expo pending the cross-platform spike
([ADR-0004](docs/adr/0004-react-native-expo-client.md)). Once the repo is bootstrapped:

1. Fill in the **Appendix: Stack Adaptation** table in
   [`skills/ultimate-dev-process/SKILL.md`](skills/ultimate-dev-process/SKILL.md) with the real
   build/lint/test/coverage commands.
2. Add a single local gate script (`./test.sh` or equivalent) that runs everything CI runs.
3. Install git hooks that run that script on `pre-commit` and enforce Conventional Commits on
   `commit-msg` (see the sibling repos' `scripts/hooks/` for a reference implementation).

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
