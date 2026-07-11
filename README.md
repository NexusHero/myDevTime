<h1 align="center">myDevTime</h1>

<p align="center">
  <strong>Time tracking that plans your day, not just logs it.</strong><br>
  iOS · Android · Web — one codebase. Tyme-class UX, Tactiq-class meeting AI, and a
  deterministic core you can trust with a timesheet.
</p>

<p align="center">
  <a href="docs/roadmap.md">Roadmap</a> ·
  <a href="docs/architecture.md">Architecture</a> ·
  <a href="docs/design/ux-vision.md">UX Vision</a> ·
  <a href="docs/adr/README.md">Decisions (ADRs)</a>
</p>

<p align="center">
  <img alt="Platforms: iOS, Android, Web" src="https://img.shields.io/badge/platforms-iOS%20%C2%B7%20Android%20%C2%B7%20Web-2563eb">
  <img alt="Built with React Native + Expo" src="https://img.shields.io/badge/React%20Native-Expo-2563eb">
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178c6">
  <img alt="Tested with Vitest" src="https://img.shields.io/badge/tested-Vitest%20%E2%89%A590%25-6E9F18">
</p>

---

## What it is

myDevTime is a cross-platform time tracker for developers, freelancers, and agencies. It takes
the two best products in the space — **Tyme's** fast, native-feeling tracking UX and **Tactiq's**
meeting AI plus credit-based monetization — and adds its own AI planning layer on top, all from a
single React Native + Expo codebase.

One principle runs through the whole architecture: **deterministic logic decides everything that
reaches a timesheet, budget, export, or invoice; AI proposes, parses, and explains — always with
recorded provenance — but never acts as the bookkeeper**
([ADR-0005](docs/adr/0005-deterministic-core-llm-assist.md)). Your numbers are exact, reproducible,
and auditable; the AI just makes them faster to get to.

## A look at it

The interface scales from phone to desktop — one codebase, native experience on every platform.

<p align="center">
  <img src="docs/media/today-phone.png" alt="Today — the Day Canvas with plan + actual, Island timer, AI proposals" width="28%">
  &nbsp;
  <img src="docs/media/projects-phone.png" alt="Projects — budgets, rates, cost tracking with consumption indicators" width="28%">
  &nbsp;
  <img src="docs/media/profile-phone.png" alt="Profile — credits, work-time, time off, and settings" width="28%">
</p>

<p align="center">
  <em>Phone tabs: Today · Projects · Profile</em>
</p>

<p align="center">
  <img src="docs/media/today-desktop.png" alt="Today on desktop — sidebar nav, two-column canvas, Island, responsive instrumentation" width="85%">
</p>

<p align="center">
  <em>Desktop: sidebar navigation, split-view canvas</em>
</p>

<p align="center">
  <img src="docs/media/projects-desktop.png" alt="Projects on desktop with sidebar, grid layout, live budget data" width="85%">
</p>

<p align="center">
  <em>Every screen works on every size, responsive instrumentation included.</em>
</p>

## Why it's different

- **A Co-Planner, not a logbook.** The **Day Canvas** shows the plan (AI-proposed *ghost blocks*)
  and reality on one surface: a morning briefing, a quiet live-drift indicator, and an evening
  review. Accept the whole plan with one tap, or sculpt it.
- **The Island.** One persistent, glanceable element carries live timer + punch + break state
  everywhere — Live Activity / Dynamic Island on iOS, an ongoing notification on Android, a
  floating pill on web. Learn it once.
- **Numbers are the product.** Every duration and amount renders in tabular numerals and is
  computed by pure, exhaustively tested logic — integer minor units, no floating-point money.
- **Provenance everywhere.** Every entry records its source (`timer · manual · calendar ·
  rule · ai-proposal`) and review state, so a machine-made suggestion is always visible as one.

## Features

| Area | Status | What you get |
|------|--------|--------------|
| **Tracking** | ✓ Live | Fast timers (one running, reboot-safe), manual entries with create/edit/split/merge, clients → projects → tasks, tags, offline-first with deterministic cross-device sync |
| **Budgets & rates** | ✓ Live | Per-project budgets with consumption bars and threshold alerts; effective-dated hourly rates (workspace → client → project → task precedence); exact integer money math |
| **Work-time story** | ✓ Live | Clock-in/out with breaks and overtime balance, vacation & sick days, and a **signable monthly work-time report** (PDF + Excel) your client or supervisor can countersign |
| **Reports & analytics** | ✓ Live | Summary tiles, project budget breakdowns, work-time gauges, weekly heatmaps, AI-credit usage tracking |
| **Meeting AI** | ⚙️ Coming | Consent-first transcription with AI summaries, action items, and reusable custom prompts |
| **Co-Planner** | ⚙️ Coming | AI-proposed day plans shown as ghost blocks, plan-vs-actual tracking, evening review with one-tap accept/sculpt |
| **Own AI layer** | ⚙️ Coming | Calendar auto-capture → deterministic rules engine with AI-assisted categorization, natural-language entry ("2h Finanzo Review yesterday"), weekly summaries & standup reports, and a grounded assistant |
| **Monetization** | ⚙️ Coming | Web + in-app subscriptions (Stripe · StoreKit 2 · Play Billing) unified behind one entitlement service, with a visible **AI-credit ledger** and purchasable top-ups |

## Status

Actively under construction. The foundations are solid, and the experience is taking shape:

- **Backend** — Fastify modular monolith with auth, the tracking core, server-authoritative sync,
  budgets & rates, timesheet exports (CSV · XLSX · PDF), the entitlement service, and Stripe
  checkout / portal / webhooks.
- **Design system** — Complete with 30 token-driven components (core UI, forms, data viz, instruments),
  three accent themes (Sovereign · Ember · Blueprint) × light/dark, WCAG AA verified across all
  combinations, responsive instrumentation (rings, gauges, sparklines, heatmaps), and deterministic
  project color assignment.
- **Clients** — Full-featured Expo/React-Native-Web codebase with responsive app shell
  (phone tabs ⇄ desktop sidebar ⇄ split-view), **live Today, Projects, Profile, Reports, Planner, and
  Assistant** screens, real-time timer with Island (iOS Live Activity / Android ongoing notification),
  meeting consent-first transcription, and AI categorization proposals.
- **Deterministic core** — money, rates, budgets, rounding, overlap resolution, sync convergence,
  attendance/absences, work-time reports, and the timesheet builder are pure and held to **≥ 90 % coverage**.

See the [roadmap](docs/roadmap.md) for milestones M0–M5 and the Definition of 1.0, and the
[Requirements Register](docs/architecture.md) for per-requirement status.

## Getting started

```bash
pnpm install          # installs deps and wires the git hooks
./test.sh             # the full local gate = what CI runs

# run the app (iOS / Android / Web) from the shared codebase
pnpm --filter @mydevtime/mobile start
```

Requires Node ≥ 22 and pnpm. `./test.sh` builds the packages, checks formatting and lint,
type-checks, runs the test suite with coverage, and verifies domain purity and docs.

## Architecture at a glance

- **Monorepo** (pnpm workspaces): `apps/api` (Fastify modular monolith), `apps/mobile` (Expo/React Native/Web),
  `packages/domain` (pure logic ≥90% coverage), `packages/design` (30 components, tokens, theme, responsive nav),
  `packages/shared` (types/schemas).
- **Design system** — Token-driven components (spacing s0–s8, typography 2xs–3xl, motion, colors),
  three accent themes (Sovereign · Ember · Blueprint) × light/dark, WCAG AA verified, deterministic project colors.
- **Ports & adapters** for volatile vendors — LLM, ASR, Stripe, StoreKit, Play Billing, calendar SDKs each sit
  behind one narrow interface; vendor types never leak upstream (ADR-0029).
- **Workspace isolation by construction** — repository APIs take a `workspaceId` non-optionally,
  with negative isolation tests per entity.

## Documentation

| Document | Content |
|----------|---------|
| [`docs/roadmap.md`](docs/roadmap.md) | Milestones M0–M5, dependency graph, Definition of 1.0, post-1.0 backlog |
| [`docs/architecture.md`](docs/architecture.md) | arc42 documentation incl. the Requirements Register (REQ-001…) |
| [`docs/design/ux-vision.md`](docs/design/ux-vision.md) | Binding UX vision: principles, Day Canvas, Co-Planner, Island, visual & motion language |
| [`docs/adr/`](docs/adr/README.md) | Architecture Decision Records + Tech Radar |
| [`skills/ultimate-dev-process/SKILL.md`](skills/ultimate-dev-process/SKILL.md) | The development process (governance, TDD, SOLID, Definition of Done) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Ways of working, branching, commits |

## License

See [LICENSE](LICENSE).
