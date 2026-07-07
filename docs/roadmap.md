# myDevTime 1.0 Roadmap

The full implementation plan to a shippable 1.0: web app (PWA-installable) on the product domain,
iOS app in the App Store, Android app on Google Play. The product unifies **Tyme's** mobile/tablet
UX with **Tactiq's** meeting AI & credit-based monetization — meeting transcription, AI insights,
and a visible AI-credit ledger are 1.0 scope — plus calendar auto-capture and an own AI layer on
top ([ADR-0002](adr/0002-product-scope-unify-tyme-and-tackle.md) as amended by
[ADR-0008](adr/0008-tactiq-realignment-transcription-and-credits.md)). Stack: Node.js/TypeScript backend
([ADR-0003](adr/0003-node-typescript-backend.md)), React Native + Expo clients
([ADR-0004](adr/0004-react-native-expo-client.md), gated on the
[#1](https://github.com/NexusHero/myDevTime/issues/1) spike).

Every work item is a tracked GitHub issue with acceptance and test criteria detailed enough to
implement from directly. Process rules (`skills/ultimate-dev-process/SKILL.md`) apply to every
issue: TDD, ≥90 % coverage on core logic, Conventional Commits, one logical change per PR,
`Closes #NNN` linking. Scope changes are recorded as ⚠️-comments on the affected issues — read an
issue's comments before implementing it.

## Milestone overview

| Milestone | Theme | Issues |
|---|---|---|
| **M0 — Foundation** | Client-stack spike, meeting-capture spike, monorepo + CI, backend skeleton, auth, data model | [#1](https://github.com/NexusHero/myDevTime/issues/1) [#31](https://github.com/NexusHero/myDevTime/issues/31) [#2](https://github.com/NexusHero/myDevTime/issues/2) [#3](https://github.com/NexusHero/myDevTime/issues/3) [#4](https://github.com/NexusHero/myDevTime/issues/4) [#5](https://github.com/NexusHero/myDevTime/issues/5) [#6](https://github.com/NexusHero/myDevTime/issues/6) |
| **M1 — Tracking core** | Time math, timers & entries, entry notes, attendance (punch clock), sync engine, budgets & rates | [#7](https://github.com/NexusHero/myDevTime/issues/7) [#8](https://github.com/NexusHero/myDevTime/issues/8) [#46](https://github.com/NexusHero/myDevTime/issues/46) [#36](https://github.com/NexusHero/myDevTime/issues/36) [#9](https://github.com/NexusHero/myDevTime/issues/9) [#10](https://github.com/NexusHero/myDevTime/issues/10) |
| **M2 — Client apps** | UX prototype (gate), design system, mobile timer UX, focus mode, idle detection, dashboard, month overview, burn-down, day list, system quick actions, absences, exports (timesheet + signable report) | [#39](https://github.com/NexusHero/myDevTime/issues/39) [#11](https://github.com/NexusHero/myDevTime/issues/11) [#12](https://github.com/NexusHero/myDevTime/issues/12) [#41](https://github.com/NexusHero/myDevTime/issues/41) [#42](https://github.com/NexusHero/myDevTime/issues/42) [#13](https://github.com/NexusHero/myDevTime/issues/13) [#47](https://github.com/NexusHero/myDevTime/issues/47) [#48](https://github.com/NexusHero/myDevTime/issues/48) [#50](https://github.com/NexusHero/myDevTime/issues/50) [#49](https://github.com/NexusHero/myDevTime/issues/49) [#37](https://github.com/NexusHero/myDevTime/issues/37) [#14](https://github.com/NexusHero/myDevTime/issues/14) [#38](https://github.com/NexusHero/myDevTime/issues/38) |
| **M3 — Automation & AI** | Calendar ingestion + write-back, rules engine, LLM proposals, NL entry, summaries, assistant, meeting transcription + insights, dev-tool export, Co-Planner | [#15](https://github.com/NexusHero/myDevTime/issues/15) [#43](https://github.com/NexusHero/myDevTime/issues/43) [#16](https://github.com/NexusHero/myDevTime/issues/16) [#17](https://github.com/NexusHero/myDevTime/issues/17) [#18](https://github.com/NexusHero/myDevTime/issues/18) [#19](https://github.com/NexusHero/myDevTime/issues/19) [#20](https://github.com/NexusHero/myDevTime/issues/20) [#32](https://github.com/NexusHero/myDevTime/issues/32) [#33](https://github.com/NexusHero/myDevTime/issues/33) [#44](https://github.com/NexusHero/myDevTime/issues/44) [#40](https://github.com/NexusHero/myDevTime/issues/40) |
| **M4 — Monetization** | Entitlement service, AI-credit ledger, Stripe web subscriptions, store IAP | [#21](https://github.com/NexusHero/myDevTime/issues/21) [#34](https://github.com/NexusHero/myDevTime/issues/34) [#22](https://github.com/NexusHero/myDevTime/issues/22) [#23](https://github.com/NexusHero/myDevTime/issues/23) |
| **M5 — Launch** | Security, privacy/DSGVO, observability, E2E, distribution, pricing | [#24](https://github.com/NexusHero/myDevTime/issues/24) [#25](https://github.com/NexusHero/myDevTime/issues/25) [#26](https://github.com/NexusHero/myDevTime/issues/26) [#27](https://github.com/NexusHero/myDevTime/issues/27) [#28](https://github.com/NexusHero/myDevTime/issues/28) [#29](https://github.com/NexusHero/myDevTime/issues/29) |

## Cross-cutting workstreams — start early, they don't wait for their milestone

1. **Client-stack spike** ([#1](https://github.com/NexusHero/myDevTime/issues/1)) — the single
   biggest de-risking item; needs real iOS + Android hardware. Everything client-side (#11–#14,
   parts of #12's background-timer work) is bet on its outcome. Do it first.
1. **Meeting-capture spike** ([#31](https://github.com/NexusHero/myDevTime/issues/31)) — the
   second big bet (ADR-0009): capture channel, ASR provider, per-minute cost, and the
   consent/legal analysis. Blocks #32/#33 and feeds #29/#34; run it in parallel with #1.
2. **Store accounts & products** — Apple Developer Program + Play Console enrollment, IAP product
   setup, and review lead times are calendar-bound, not code-bound. Enroll during M0; configure
   products when [#23](https://github.com/NexusHero/myDevTime/issues/23) starts; budget review
   cycles into [#28](https://github.com/NexusHero/myDevTime/issues/28).
3. **LLM & ASR cost data** ([#17](https://github.com/NexusHero/myDevTime/issues/17)–[#20](https://github.com/NexusHero/myDevTime/issues/20)
   [#32](https://github.com/NexusHero/myDevTime/issues/32) metering) — pricing
   ([#29](https://github.com/NexusHero/myDevTime/issues/29)) and the credit cost table
   ([#34](https://github.com/NexusHero/myDevTime/issues/34)) need real per-action/per-minute
   numbers; instrument from the first call, don't reconstruct later.
4. **UX prototype** ([#39](https://github.com/NexusHero/myDevTime/issues/39)) — design is
   calendar-bound like the spikes: start the vision-to-Figma work during M0/M1 so the #39 → #11
   gate never idles the client track. The Day Canvas micro-interactions must be settled before
   M2 component work.
5. **Provider DPAs / no-training confirmations**
   ([#25](https://github.com/NexusHero/myDevTime/issues/25)) — verify before choosing the default
   LLM provider in [#17](https://github.com/NexusHero/myDevTime/issues/17), not after.

## Dependency shape (critical path)

```
M0  #1 (client spike → ADR-0004 accepted) ──────┐
    #31 (capture spike → ADR-0009 accepted) ──── │ ──────────────┐
    #2 (bootstrap) ──► #3 (backend skeleton)     │               │
                          ├──► #4 (auth) ──► #5 (OAuth sign-in)  │
                          └──► #6 (data model)   │               │
                                    │            │               │
M1  #7 (tracking core, pure) ◄──────┘            │               │
      ├──► #8 (timers & entries) ──► #9 (sync)   │               │
      ├──► #36 (attendance: punches, breaks, overtime)           │
      └──► #10 (budgets & rates)                 │               │
                                    │            │               │
M2  #39 (UX prototype, gate) ──► #11 (design system) ◄─┴─────────┘
      ├──► #12 (mobile timer UX + punch UI) ◄── #8 + #36         │
      ├──► #13 (dashboard: projects + work hours) ◄── #7/#10/#36/#37
      ├──► #37 (absences) ◄── #36                                │
      ├──► #14 (timesheet export) ◄── #7 + #10                   │
      └──► #38 (signable report PDF/XLSX) ◄── #36 + #37          │
                                    │                            │
M3  #15 (calendar) ──► #16 (rules engine) ──► #17 (LLM proposals)│
              │                                  ├──► #18 (NL entry)
              │                                  ├──► #19 (summaries) ◄── #7/#10
              │                                  └──► #20 (assistant) ◄── #11 deep links
              └──► #32 (transcription pipeline) ◄────────────────┘
                          └──► #33 (meeting insights) ◄── #17 + #34
    #40 (Co-Planner) ◄── #7 + #15 + #17 + #36 + #11/#39 (Day Canvas)
                                    │
M4  #21 (entitlements) ──► #34 (AI-credit ledger)
                      ├──► #22 (Stripe web  + credit top-ups)
                      └──► #23 (store IAP   + consumable packs)
                                    │
M5  #24 (security) · #25 (privacy) · #26 (observability) · #27 (E2E)
                                    ▼
    #28 (stores + web launch) ◄── #23 + #25 + #29 (pricing ADR)
```

Parallelism notes:
- #1, #31, and #2 run in parallel from day one; #3–#6 are sequential on #2 (with #4∥#6 possible).
- #7 is a pure package — it can start against fixture contracts as soon as #2 lands, before the
  backend skeleton is finished.
- #10 (budgets/rates) is independent of #8/#9 — a good parallel track inside M1.
- #36 (attendance) is pure-core + API work parallel to #8; #37 (absences) follows it; both are
  independent of the calendar/AI chain.
- #16 (rules engine, pure) can be developed against the `CandidateEntry` contract before #15's
  providers are finished.
- #21 (entitlements) is pure domain work — it can start any time after #3; only its enforcement
  points wait for the AI issues.
- M5's #24–#27 start as soon as their target features exist; they finish last. #29 (pricing) can
  be decided as soon as #17–#20 metering data exists.

## Definition of 1.0

1.0 is shippable when **all** hold:

- All M0–M5 issues closed (each with its acceptance criteria checked and tests landed per the
  process gates, and any ⚠️ scope-update comments applied), or explicitly re-scoped by a
  documented decision.
- [ADR-0004](adr/0004-react-native-expo-client.md) resolved to **Accepted** (or superseded and
  the client re-planned) via [#1](https://github.com/NexusHero/myDevTime/issues/1) — no client
  code merged before that.
- [ADR-0009](adr/0009-meeting-capture-asr-approach.md) resolved via
  [#31](https://github.com/NexusHero/myDevTime/issues/31), and meeting transcription + AI
  insights ([#32](https://github.com/NexusHero/myDevTime/issues/32)
  [#33](https://github.com/NexusHero/myDevTime/issues/33)) shipped consent-first — 1.0 scope by
  explicit owner decision (ADR-0008), not silently deferrable.
- The deterministic-core discipline holds product-wide: no number on a timesheet, export, or
  invoice produced by an LLM ([ADR-0005](adr/0005-deterministic-core-llm-assist.md)); provenance
  recorded on every entry; slot-integrity tests green on all generated narrative (#19, #20).
- The AI feature set (#17–#20) is 1.0 scope by explicit owner decision — it is the
  differentiator, not silently deferrable.
- Subscriptions **and AI-credit top-ups** purchasable on all three rails (#22, #23) with
  entitlements and the credit ledger (#21, #34) converging deterministically; pricing decided
  and recorded as an ADR (#29).
- E2E suite (#27) green and flake-free (20 consecutive runs) in CI.
- Web app live (own domain, PWA-installable), Play + App Store builds approved at least on their
  test tracks ([#28](https://github.com/NexusHero/myDevTime/issues/28)).
- Security (#24), privacy (#25), and observability (#26) baselines fully landed — these are
  launch gates, not fast-follows.
- The work-time story complete per [ADR-0010](adr/0010-attendance-absences-signable-report.md):
  attendance (#36), absences (#37), and the signable PDF/XLSX report (#38) shipped — the punch
  clock is 1.0 scope, not a fast-follow.
- The competitive-adoption set per [ADR-0012](adr/0012-competitive-feature-adoption.md): focus
  mode + streaks (#41), idle detection (#42), calendar write-back (#43), dev-tool export (#44) —
  #44 may degrade to Slack-first if the schedule demands it (documented in the ADR).
- The Co-Planner (#40) shipped per [ADR-0011](adr/0011-ai-co-planner-and-design-language.md):
  plan entity + Day Canvas + manual timeboxing are hard 1.0; if M3 overruns, only the AI
  proposal garnish may degrade (documented fallback in the ADR) — and the shipped UI passed the
  #39 prototype gate, no design-in-code shortcuts.

## Post-1.0 backlog (deferred deliberately, not forgotten)

- **Developer-focused capture**: Git-commit/branch/issue-key → auto-suggested entries, IDE
  presence signals — the "myDevTime" name is a program (ADR-0002). (Insight *export* to
  Jira/Linear/Slack is 1.0 since ADR-0012; *capture from* those tools is this backlog item.)
- **Platform depth**: macOS/watchOS apps, widgets & watch complications beyond the 1.0
  notification/Live-Activity surface.
- **Teams**: shared workspaces, roles, approval flows, team analytics, auto-shared meeting
  insights (Tactiq's Team/Business tiers).
- **Capture channels beyond ADR-0009's winner**: mobile in-person recording, additional meeting
  platforms, offline transcription.
- **Billing depth**: full invoice generation (numbering, VAT), multi-currency, payment-status
  tracking, **expense tracking with receipt photos and flat-fee (Pauschale) entries**;
  RevenueCat adoption if #23 maintenance proves costly.
- **Teams (additions)**: absence **approval workflow** (Requested/Approved states, as seen in
  attendance competitors).
- **AI depth**: learning loop from accepted/corrected proposals (the data is already captured per
  ADR-0005), additional LLM providers, voice-first capture beyond platform dictation.
- **Auth depth**: 2FA/passkeys, magic links.
- **Work-time depth**: digital signature/approval workflow on the work-time report (drawn or
  cryptographic signatures — 1.0 report is print/PDF-countersign, ADR-0010), geofenced
  auto-punch, multi-employer schedules.
- **CSV/transcript import** from Tyme/Toggl/Tactiq for switchers; localization beyond de/en.
