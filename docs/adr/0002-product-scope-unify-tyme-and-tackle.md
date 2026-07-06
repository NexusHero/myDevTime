# ADR 0002: Product Scope — Unify Tyme's Mobile UX with Tackle's AI Automation & Billing

## Status

Accepted — amended by [ADR-0008](0008-tactiq-realignment-transcription-and-credits.md): the
second reference product is **Tactiq** (tactiq.io), not Tackle (a research misidentification);
meeting transcription + AI meeting insights join the 1.0 scope. Everything else below stands.

## Context

Two existing products define the state of the art in personal/freelancer time tracking, and each
has what the other lacks:

- **Tyme** (tyme-app.com — iOS/iPadOS/macOS/watchOS) is the benchmark for **mobile- and
  tablet-first UX**: fast manual timers, a clean project → task hierarchy, budgets and deadlines,
  beautiful statistics, widgets, offline-first with device sync. But it is Apple-only, has no web
  app, no calendar-based auto-capture, no AI, and no integrated billing workflow.
- **Tackle** (timetackle.com — web) is the benchmark for **automated, AI-assisted tracking and
  monetization**: it connects Google/Outlook calendars, auto-captures activities, categorizes
  entries with rules + AI, applies hourly rates per project/client, and turns tracked time into
  accurate invoicing and profitability reporting via a subscription business model. But it is
  web-generic, calendar-centric, and nowhere near Tyme's native mobile experience.

The owner's thesis: a single product that unifies both — Tyme-class mobile/tablet UX **and**
Tackle-class AI automation + billing — with its **own AI layer on top** (natural-language time
entry, AI-generated summaries/reports, an assistant grounded in the user's own tracking data),
available on **iOS, Android, and Web**, with real **authentication** and **payment/subscription**
infrastructure from the start.

## Decision

myDevTime is a cross-platform (iOS + Android + Web) time-tracking product for developers,
freelancers, and small teams whose 1.0 scope is the union of:

1. **Tracking core (Tyme-inspired):** clients → projects → tasks, manual timers + manual entries,
   budgets (money/hours), hourly rates, deadlines, offline-first local storage with cross-device
   sync, statistics and timesheet export.
2. **Automation & AI (Tackle-inspired):** calendar integration (Google/Microsoft) as an
   auto-capture source, a deterministic rules engine for auto-categorization with an LLM assist
   layer (ADR-0005), and billing-grade rate/invoice output.
3. **Own AI on top:** natural-language time entry, AI weekly/monthly summaries and standup
   reports, and a chat assistant strictly grounded in the user's own data.
4. **Commercial foundation:** authentication (ADR-0007) and subscription billing across web and
   both app stores (ADR-0006).

Non-goals for 1.0: team/enterprise administration beyond a personal workspace, macOS/watchOS
native apps, screen-time/app-usage surveillance tracking, and any integration marketplace. These
are backlog, not scope.

## Consequences

- The dual inspiration is an explicit design constraint: every tracking-core feature is judged
  against "would this feel at home in Tyme on a phone?", every automation feature against "does
  this reach Tackle-level automation without its web-only genericness?".
- Three platforms from day one forces the client-stack decision (ADR-0004) toward a shared
  codebase and forces offline-first sync (REQ-006) into the core architecture instead of a
  retrofit.
- Billing across web + App Store + Play Store means dealing with three payment rails and their
  fee/policy differences from the start (ADR-0006) — deferred, this would poison the data model
  (entitlements) later.
- Competing with two established products on their home turf is deliberate; the differentiator is
  the *union* plus the own AI layer, not any single feature.
- "Developers" as the primary persona (the name is a program) shapes defaults — keyboard-first web
  UX, Pomodoro-friendly timers, Git/issue-tracker integrations as post-1.0 backlog — but nothing
  in the core excludes general freelancers.
