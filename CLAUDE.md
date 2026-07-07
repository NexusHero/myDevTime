# CLAUDE.md — Agent Orientation for myDevTime

This repo is in the **pre-code planning phase**: the product, architecture, process, and backlog
are fully specified in documentation; implementation starts with milestone M0. An agent (or
human) picking up any task gets the complete picture by reading, in this order:

1. **[`skills/ultimate-dev-process/SKILL.md`](skills/ultimate-dev-process/SKILL.md)** — the
   governance process. Applies to every change, automatically: TDD (test before implementation),
   ≥90 % coverage on core logic, SOLID as a merge gate, Conventional Commits, one logical change
   per PR, ADR in the same PR for every architecturally relevant decision.
2. **[`docs/adr/README.md`](docs/adr/README.md)** — all decisions + Tech Radar. Never edit an
   accepted ADR; amend or supersede with a new one (ADR-0008 is the worked example).
3. **[`docs/architecture.md`](docs/architecture.md)** — arc42 documentation. §1 contains the
   **Requirements Register (REQ-001…REQ-027)**: every requirement with the issue that delivers
   it and its status. Keep this register and the Runtime View current in the same PR that
   changes them.
4. **[`docs/roadmap.md`](docs/roadmap.md)** — milestones M0–M5, the dependency graph (what
   blocks what), and the Definition of 1.0.
4a. **[`docs/design/ux-vision.md`](docs/design/ux-vision.md)** — binding for any client/UI work:
   design principles, the Day Canvas/Co-Planner/Island concepts, IA, visual & motion language.
   UI that contradicts it fails review.
5. **The GitHub issue you are implementing** — each issue (#1–#34) carries milestone, REQ/ADR
   references, acceptance criteria (checkboxes), and the test approach. **Read the issue's
   comments first**: scope changes are recorded as ⚠️-comments and override the issue body.

## What the product is (one paragraph)

Cross-platform time tracking (iOS + Android + Web from one codebase) that unifies **Tyme's**
mobile/tablet UX with **Tactiq's** meeting AI & credit-based monetization, plus an own AI layer:
calendar auto-capture, deterministic rules engine, AI categorization proposals, natural-language
time entry, meeting transcription with AI insights, AI summaries, a grounded assistant, an AI
**Co-Planner** (proposed day plans as ghost blocks, plan-vs-actual, evening review) — and the
full work-time story (clock-in/out with breaks and overtime, vacation/sick days, a signable
PDF/XLSX work-time report) — monetized via subscriptions (Stripe + store IAP) and a visible
AI-credit ledger. See ADR-0002 as amended by ADR-0008 and extended by ADR-0010/0011.

## Non-negotiable design rules (from the ADRs — violating these fails review)

- **Deterministic core (ADR-0005):** every number that reaches a timesheet, budget, export, or
  invoice is computed by pure, exhaustively tested logic in `packages/domain`. LLMs propose,
  parse, explain — always marked as proposals, always with provenance, never mutating state on
  their own. AI features degrade gracefully when the provider is down.
- **Provenance everywhere:** every time entry records its source
  (`timer | manual | calendar | rule:<id>@<version> | ai-proposal`) and review state.
- **Ports & adapters for volatile vendors (§2.2 of the skill):** LLM, ASR, Stripe, StoreKit,
  Play Billing, calendar SDKs — one narrow interface each, vendor types confined to a single
  adapter file. Nothing upstream imports vendor types.
- **Workspace isolation by construction:** repository-layer APIs take a workspace id,
  non-optionally. Negative isolation tests are part of every entity's test suite.
- **Entitlements/credits, not payment SDKs:** feature gates ask the `billing` module
  (entitlement API + credit ledger). No client or feature ever talks to a payment SDK directly.
- **Consent-first capture:** no meeting capture path may exist without stored, explicit opt-in
  (REQ-025).
- **TypeScript `strict` everywhere; no blanket suppressions.**

## Stack (decided / pending)

| Layer | Decision | Status |
|-------|----------|--------|
| Backend | Node.js + TypeScript modular monolith: `auth`, `tracking`, `sync`, `automation`, `ai`, `billing` | ADR-0003, Accepted |
| Clients | React Native + Expo (+ react-native-web, EAS) — one codebase for iOS/Android/Web | ADR-0004, **Proposed — no client code before spike #1 resolves it**; Flutter is the named fallback |
| Meeting capture / ASR | Decision frame fixed, winner pending spike #31 | ADR-0009, Proposed |
| Toolchain | pnpm workspaces · TS strict · Vitest (+v8 coverage ≥90% on `domain`) · ESLint flat + Prettier · `./test.sh` gate = CI · git hooks | ADR-0014, Accepted (issue #2) |
| Monorepo layout | `apps/api` (skeleton in #3), `apps/mobile` (README-only, gated on #1), `packages/domain` (pure logic), `packages/shared` (types/schemas); `spikes/*` outside the workspace | Bootstrapped (#2) |
| Persistence, backend framework, ORM | Decided as a fresh ADR when issue #3 lands | Open |

Run `pnpm install` once (wires git hooks), then `./test.sh` is the local gate.

## Working on a task — checklist

1. Pick the issue; check the roadmap's dependency graph that its blockers are closed.
2. Read the issue body **and all ⚠️ comments**; read the ADRs it references.
3. Branch `feat/…` (or `fix/`, `docs/`, …), write the failing test first, implement, keep the
   register/ADRs/diagrams current in the same PR.
4. PR links the issue (`Closes #NNN`), fills the template, passes the full Definition of Done
   (skill §7). Anything unrelated you find on the way gets its own issue — never silently fixed
   or silently dropped.
