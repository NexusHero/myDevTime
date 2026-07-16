---
name: ultimate-dev-process
description: Vendor-neutral, stack-agnostic development governance that unifies architecture governance, TDD/testing discipline, implementation style, and commit/PR workflow into one Definition of Done for architects, engineers, and QA.
---
# Ultimate Development Process

Merged from two production processes (ElliotWaveAnalyzer, Résumé/myJob) and hardened with the
gaps neither covered on its own. One process, three roles, one Definition of Done — so an
architect, an engineer, and a QA/test engineer can sit down together and know exactly which of
them owns which gate, and where the seams between their work are.

Applies to humans and AI coding agents alike. An agent follows every section below automatically,
without being asked — the same way a senior engineer would not need reminding to write a test.

---

## Roles

| Role | Owns |
|------|------|
| **Software Architect** | Requirements Register, ADRs, Quality Goals, the Tech Radar, architecture conformance in review |
| **Software Engineer** | Implementation style (SOLID), TDD, the code itself, its unit/pure-logic tests |
| **QA / Test Engineer** | Test strategy shape (the pyramid), test *quality* (not just the coverage %), acceptance/e2e tests, the security checklist |
| **AI coding agent** | All of the above, applied on every change, without being asked |

No role is a gate-keeper of last resort — each gate below is owned by whoever is closest to it,
and checked by the *other* two roles in review (see **Reviewer Protocol**).

---

## 0. Definition of Ready — before work starts

A work item is ready to pick up when it has:

- a stable id (`REQ-NNN` or equivalent) and a one-paragraph acceptance criterion,
- the quality attribute(s) it affects named (correctness / security / performance / …), and
- a rough test approach (what kind of test will prove it's done — not the test code itself).

If it crosses a trust boundary (auth, money, PII, a new external integration) it is flagged for a
security pass **before** implementation starts, not discovered in review.

Work without an id is fine for spikes/experiments; it does not enter the Requirements Register and
does not get an ADR — but it also does not merge to the main line as a delivered feature.

---

## 1. Architecture Governance

Architecture documentation is part of the change, not a follow-up. A PR that changes architecture
without the matching documentation is **not done** — exactly like a PR with a failing test.

### 1.1 Requirements Register

Every feature starts from a requirement with a stable id (`REQ-NNN`), tracked in a living register
(`docs/architecture.md` §1 or equivalent). A ticket/issue is where the requirement is *discussed*;
the register is where it is *tracked*. Each row carries: id, short statement, the issue/PR that
delivers it, status (`Proposed` → `In Progress` → `Fulfilled`).

### 1.2 ADRs — one decision, one file, never edited after acceptance

Any of the following **requires an ADR**, in the **same PR**:

- adding, removing, or swapping a technology/library/external service,
- introducing or changing a cross-layer boundary, an abstraction, or a major algorithm,
- any decision a future maintainer would ask *"why was it done this way?"* about.

Routine dependency bumps and plain bug fixes don't need one.

Format is lightweight [MADR](https://adr.github.io/madr/): **Context → Decision → Consequences**
(+ **Alternatives considered** when the choice was close), plus a status. Numbering is sequential
and immutable. A decision that replaces another **supersedes** it — mark the old one
`Superseded by ADR-NNN` — never rewrite history.

### 1.3 Sequence diagrams for fulfilled requirements

When a requirement is fulfilled, add or update a sequence diagram (Mermaid or PlantUML — pick one
per project and stay consistent) in the Runtime View showing the actual call flow across the real
building blocks. It documents reality: it must match the code shipping in the same PR. Link it to
its `REQ-NNN`.

### 1.4 Tech Radar — so the ADR log doesn't become the only way to see the shape of the stack

Once a project accumulates a couple dozen ADRs, "what's our stance on X" stops being answerable by
skimming. Keep a short **Tech Radar** table (Adopt / Trial / Assess / Hold) next to the ADR index —
one line per technology, linking back to the ADR that decided it. This is a index, not a process:
it costs one line per ADR and pays for itself the first time someone asks "can I use gRPC here."

### 1.5 Docs staleness is a CI gate, not a review nitpick

Manual review catches stale docs unreliably. Add a deterministic, dependency-free check (no LLM,
no network) to CI that fails the build on structural drift:

- a diagram source (`.puml`/`.mmd`) with no rendered output, or an orphaned render with no source,
- a relative Markdown link that points at a file that doesn't exist,
- an `ADR-NNNN` reference with no matching ADR file.

This is cheap, deterministic, and catches the exact rot manual review misses under deadline
pressure.

---

## 2. Implementation Style

### 2.1 SOLID is a quality gate, not an aspiration

Reviewed on every PR, weighted the same as the tests. The two violations to watch hardest:

- **No god classes (SRP).** If a class fetches *and* calculates *and* orchestrates *and*
  persists, split it. If you cannot state its single reason to change in one sentence, it's wrong.
  Business logic lives in small, pure, dependency-free classes; orchestration/glue stays thin.
- **Depend on interfaces, not concretes, across a boundary (DIP).** Consumers depend on
  abstractions; infrastructure implementations (a specific SDK, a specific DB driver) never leak
  into domain/application code. New behavior is a new implementation + one wiring line — existing
  classes are not modified (OCP).

A PR that introduces a god class, or a concrete dependency where an interface should stand, is
**not done** — same as a PR with a failing test.

### 2.2 Isolate volatile third-party surface

Any SDK/library that changes fast, or that you might swap later (an LLM SDK, a payment provider, a
charting library) is wrapped behind one narrow interface, with its types confined to a single
adapter file. Nothing upstream of that file ever imports the vendor's types.

### 2.3 Config over hardcoding

API keys, model/version names, endpoints, feature toggles — all configuration, never literals in
source. A vendor deprecating a model version or rotating an endpoint should be a config change, not
a deploy.

### 2.4 Language-appropriate strictness, always on

Whatever the stack's strict mode is (nullable reference types, TypeScript `strict`, a linter's
strictest preset) — it's on project-wide, with no blanket suppressions. A suppression needs a
comment explaining why, not just `// eslint-disable`.

---

## 3. Testing Behavior

### 3.1 TDD: Red → Green → Refactor

Tests are written **before** the implementation. New behavior arrives with the test that specifies
it, in the same commit/PR — never code first, tests bolted on after (or never).

### 3.2 Naming and structure

```
Subject_StateUnderTest_ExpectedBehaviour
```

Examples: `CalculateRsi_AllGains_RsiApproachesOneHundred`,
`ValidateAsync_InvalidLabel_ThrowsArgumentException`.

Bodies follow **Arrange–Act–Assert** with a blank line between each phase. Never abbreviate a shown
test with `// ...` — show the whole thing.

### 3.3 The pyramid, and what each layer is for

| Level | What it tests | Rule |
|-------|---------------|------|
| **Pure-logic / unit** | Deterministic cores — rule checkers, calculators, parsers, evaluators | No mocks needed — exhaustive fixtures, no I/O |
| **Service / orchestration** | Delegation, provider selection, input validation | Mock the ports (interfaces), not the concretes |
| **Acceptance / integration** | The real API against a real datastore | Only genuinely external systems (LLM, third-party API) are faked |
| **Component / e2e** | UI against the real DOM/browser | Cover the golden path + empty/loading/error states |

**Never call a real external system (network, LLM, paid API) from a unit test.** Use seeded,
deterministic fixtures — one shared fixture module, not ad-hoc arrays scattered across test files.

### 3.4 Coverage is architectural, not brute-forced

Target **≥ 90% line coverage on core/business logic**, enforced as a CI-blocking gate — not an
aspiration in a doc nobody reads. The way to hit it: keep business logic in pure, dependency-free
classes so it is trivially and exhaustively testable; orchestration/glue stays thin and needs fewer
tests. Shallow tests that chase the percentage without exercising real behavior don't count, and a
reviewer should say so.

---

## 4. Security & NFR Gate

Keep a short, concrete checklist (adapt the specifics to the stack, keep the shape):

- **AuthN/AuthZ** — every business endpoint requires auth explicitly; public endpoints are
  explicitly marked public, not accidentally open.
- **Rate limiting** — every endpoint has an explicit policy; tighter limits on anything that calls
  a paid/LLM API or handles login.
- **Input validation** — every write endpoint validates; free-form strings that reach an external
  system go through an allowlist; numeric ranges are explicitly bounded.
- **CORS** — no wildcard origins; explicit allowlist.
- **Secrets** — never in source or committed config; read from environment/secret manager; local
  override files are gitignored.
- **Headers** — security headers and HSTS on in non-dev environments; a CSP that names only known
  external domains.
- **Logging** — no PII/secrets in log lines; security-relevant events (auth failures, rate-limit
  hits) are logged at a level that alerts.

**Lightweight threat-model trigger:** any change that adds a new external integration or a new
trust boundary gets a security-checklist pass *before* merge — not as an afterthought once
something breaks in production.

---

## 5. Commit & Branching

Conventional Commits, in English:

```
type(scope): short summary in imperative mood
```

Types: `feat` · `fix` · `docs` · `test` · `refactor` · `chore` · `ci` · `build` · `perf` ·
`style` · `revert`.

Branches: `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`, `test/`, `ci/` + short description.

**Automate the enforcement, don't rely on memory.** Install local git hooks:

- `pre-commit` runs the full local gate (format + lint + tests) — the same thing CI runs.
- `commit-msg` rejects a commit whose subject doesn't match Conventional Commits.

Provide **one script** that *is* the local gate and *is* what CI runs — `./test.sh` or equivalent —
so "did you run the checks" is never a review question.

---

## 6. Pull Request Workflow

- **`main` is protected. Merge only via PR — no direct pushes.**
- **One logical change per PR.** Larger changes get an issue first to discuss the approach.
- **Every task has a tracked issue; every PR links it** (`Closes #123`). This is what keeps the
  history traceable after the fact — a PR with no linked issue is missing context a reviewer has
  no other way to recover.
- All CI checks green, all review threads resolved, branch up to date with base — all three,
  before merge.

### Issue Discipline — nothing found gets silently dropped

Every task, story, and bug fix gets its issue before work starts (§0) — no issue, no delivered
feature, regardless of how small the change feels.

This extends to anything surfaced *along the way*. If work on one task turns up an unrelated
defect, risk, missing test, or piece of debt, it does not get silently folded into the current PR
(scope creep) and it does not get silently ignored either. File an issue for it on the spot, then
pick one of two honest paths:

- **Fix it now**, in its own commit or a small follow-up PR that links the new issue — reasonable
  when it's small and separable from the current change.
- **Defer it**, leaving the issue open and prioritized — never closed as "not now" without a
  one-line reason recorded on the issue itself.

What never happens: a defect noticed and left with no trace, or quietly patched with no issue link
so a future reader has no way to know it was ever a known risk.

### Reviewer Protocol — the gap most process docs leave implicit

The PR template checklist is the *author's* self-check. The reviewer's job is a distinct pass, not
a re-read of the same checklist:

1. **Architecture conformance** — does this match the ADRs and the Requirements Register, or does
   it quietly introduce a new pattern that needs its own ADR?
2. **Test quality, not test quantity** — do the tests assert behavior, or just execute lines? Would
   they fail if the logic were subtly wrong? A green coverage number with weak assertions is a
   finding, not a pass.
3. **Security checklist** — applied by the reviewer independently, not trusted from the author's
   checkbox, for anything touching a trust boundary.
4. **Docs currency** — does the changed behavior show up in the docs a future reader would consult?

### The eight review perspectives — the standing review lens

The four passes above are the *shape* of a review. **Who** performs them — and the specific class
of failure each is hunting — is fixed by eight standing perspectives. Every non-trivial change is
reviewed through all eight; on a small change one reviewer wears several hats, but no perspective
is skipped by default. These are the same eight the periodic codebase audit fans out (see
[`docs/audit/`](../../docs/audit/)), promoted from a point-in-time exercise to the everyday lens —
so a review is not "one person's read" but a checklist of eight distinct failure modes.

| # | Perspective | The question this lens asks |
|---|-------------|-----------------------------|
| 1 | **Requirements Engineer** | Does the change match its `REQ-NNN` and the register's stated status? Are the register **and** the traceability matrix updated in *this* PR? Is any delivered scope left undocumented, or any status overstated? |
| 2 | **Architect** | Does it conform to the ADRs and the module boundaries, or smuggle in a new pattern that needs its own ADR? Is the deterministic core kept pure (ADR-0005)? Are volatile vendors confined to one adapter (§2.2)? No god classes; dependencies through interfaces, not concretes (SOLID)? |
| 3 | **Software Developer** | Is the code correct at the edges — null/empty/boundary/overflow, timezone/DST, integer-money? Is it readable and idiomatic to its neighbours? Are error paths handled, not swallowed? |
| 4 | **DevOps Engineer** | Does it deploy and roll back safely — migrations under a lock, replicas, secrets, health/readiness, non-root containers? Is anything that can fail in production observable (§8)? |
| 5 | **Tester** | Do the tests assert *behaviour*, and would they fail if the logic were subtly wrong? Are the concurrency, negative-isolation, and error-mapping paths covered — not just the happy path? Is there an **acceptance-tier test** exercising the requirement end-to-end against the real system (§7)? |
| 6 | **UX Designer** | Does the UI honour the UX vision and the design system? English-only copy, honest empty/loading/error states, no fabricated numbers, touch targets and motion within spec? |
| 7 | **Customer / User** | Does the feature actually do what it claims from the user's seat — no silently-discarded input, no dead affordance, no false confirmation, no data loss on the real render target? |
| 8 | **Security & Correctness** | Every trust boundary checked: authz, workspace isolation by construction, idempotency/replay, no self-mint / self-grant, no PII in logs, deterministic numbers correct to the last minor unit? |

**Adversarial verification — the rule that keeps the review honest.** A finding is not reported
because it *looks* wrong; it is reported because a second, skeptical pass tried to **disprove** it
and failed. Every candidate separates **FAKT** (proven from the code, cited `file:line`) from
**RISIKO** (a real but conditional failure) from **MEINUNG** (taste); only FAKT/RISIKO that
survive the disprove-pass reach the author, each carrying its `file:line` evidence. No false
alarms, no vibes — a claim without a citation is not a finding.

---

## 7. Definition of Done — the master checklist

A change is done, and its PR mergeable, only when **all** hold:

- [ ] Build succeeds; strict/lint checks pass with zero suppressions added without justification
- [ ] All tests green, none skipped; new behavior has a test written before the implementation
- [ ] Line coverage on core logic stays **≥ 90%**, achieved architecturally, not by shallow tests
- [ ] **Every delivered requirement carries an acceptance-tier test** — the requirement exercised
      end-to-end against the real system (API-integration against a real datastore, or a browser
      E2E for a user-facing golden path; a client render test for a client-only requirement) —
      named in the requirements-traceability matrix. A requirement reaching Done/Verified without
      one is not done
- [ ] **SOLID holds**: no god classes, dependencies through interfaces across boundaries
- [ ] Every new endpoint/entry point is exercised by a test **and** documented (OpenAPI/equivalent)
- [ ] No secrets, API keys, or PII committed
- [ ] Security checklist applied if the change crosses a trust boundary
- [ ] **Architecture Governance**, if architecturally relevant: ADR added/updated · Requirements
      Register updated · sequence diagram added/updated for a fulfilled requirement · affected
      docs sections corrected — all in the same PR
- [ ] Commit messages are Conventional Commits; branch follows the naming convention
- [ ] PR links its issue; one logical change; all CI green; review threads resolved
- [ ] Anything found along the way that's out of scope has its own issue — not silently fixed
      inline, not silently skipped
- [ ] `git status` clean — no file the change depends on is left untracked

---

## 8. Observability & Rollback

For anything architecturally relevant, answer *before* merging: **how will we know, in production,
if this breaks?** — a log line, a metric, or an alert. Not every PR needs new dashboards; every PR
that changes a cross-cutting concern or a user-facing critical path needs an answer to this
question, not silence.

- Structured logging for anything architecturally significant; never log PII or secrets.
- Prefer changes that degrade gracefully (a failed optional enrichment shows a clear "unavailable"
  state) over ones that take the whole request down.
- If a change is risky enough to want a fast rollback path, say so in the PR description — that's
  a fact for the reviewer and the on-call, not an implementation detail to bury in the diff.

---

## 9. AI Agent Guidance

This skill is vendor-neutral and stack-agnostic on purpose. A project should pair it with:

- a **stack appendix** (below) filling in the actual commands, and
- an optional **vendor-specific overlay** (e.g. a `<project>-claude` skill) for model defaults,
  thinking-effort settings, and terse-style preferences — the same split ElliotWaveAnalyzer uses
  between its vendor-neutral `elliottwave-agents` skill and the `elliottwave-claude` overlay.

An agent applies Sections 0–8 automatically, on every change, without being asked — the same way it
would not need reminding to write a test.

---

## Appendix: Stack Adaptation

Stack: pnpm-workspace TypeScript monorepo (ADR-0003/0014). Node ≥ 22, pnpm ≥ 10.
Run `pnpm install` once (it wires the git hooks via `core.hooksPath`).

| Gate | Command |
|------|---------|
| Full local gate (mirrors CI) | `./test.sh` (or `pnpm gate`) |
| Build | `pnpm build` (`pnpm -r build`) |
| Lint / format check | `pnpm lint` · `pnpm format:check` (fix: `pnpm format`) |
| Unit / pure-logic tests | `pnpm test` (`vitest run`) · watch: `pnpm test:watch` |
| Integration / acceptance tests | _added with the backend skeleton (#3); same `vitest run`_ |
| Coverage report | `pnpm coverage` — ≥ 90% gate on `packages/domain` |
| Type check | `pnpm typecheck` (`pnpm -r typecheck`, `tsc --noEmit`) |
| Docs staleness | `pnpm check:docs` (dead links · dangling ADR refs · orphan diagrams) |
