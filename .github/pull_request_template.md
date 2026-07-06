<!--
Thanks for contributing to myDevTime!
Please fill in the sections below. Keep the PR focused — one logical change per PR.
-->

## Summary

<!-- What does this PR do, and why? Link the motivating issue. -->

Closes #

## Type of change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `refactor` — code change that neither fixes a bug nor adds a feature
- [ ] `test` — adding or correcting tests
- [ ] `chore` / `ci` — tooling, dependencies, or pipeline

## How was this tested?

<!-- Commands you ran, scenarios you covered, and anything reviewers should reproduce. -->

## Checklist (see `skills/ultimate-dev-process/SKILL.md` §7 for the full Definition of Done)

- [ ] Full local gate passes
- [ ] New behavior has a test written before the implementation (TDD)
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
- [ ] New tests use the `Subject_StateUnderTest_ExpectedBehaviour` naming convention
- [ ] **SOLID holds**: no god classes (SRP); new code depends on interfaces, not concrete types
      (DIP); extension over modification (OCP)
- [ ] Line coverage on core logic stays ≥ 90%
- [ ] No API keys, secrets, or PII committed
- [ ] Security checklist applied if this change crosses a trust boundary
- [ ] **Architecture Governance** (for architecturally-relevant changes): ADR added ·
      Requirements Register updated · sequence diagram added/updated for a fulfilled requirement
- [ ] Any unrelated bug/defect found while working this task got its own issue — not silently
      fixed inline, not silently skipped
- [ ] `Closes #` above links a real issue

## Screenshots / notes

<!-- For UI changes, add before/after screenshots. Otherwise delete this section. -->
