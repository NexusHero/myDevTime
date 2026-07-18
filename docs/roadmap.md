# myDevTime 1.0 Roadmap

The full implementation plan to a shippable 1.0: web app (PWA-installable) on the product domain,
iOS app in the App Store, Android app on Google Play. The product unifies **Tyme's** mobile/tablet
UX with **Tactiq's** meeting AI & credit-based monetization — meeting transcription, AI insights,
and a visible AI-credit ledger are 1.0 scope — plus calendar auto-capture and an own AI layer on
top ([ADR-0002](adr/0002-product-scope-unify-tyme-and-tackle.md) as amended by
[ADR-0008](adr/0008-tactiq-realignment-transcription-and-credits.md)). Stack: Node.js/TypeScript backend
([ADR-0003](adr/0003-node-typescript-backend.md)), React Native + Expo clients
([ADR-0004](adr/0004-react-native-expo-client.md), Accepted (provisional) — spike
[#1](https://github.com/NexusHero/myDevTime/issues/1) passed; [findings](spikes/0001-client-rn-expo.md)).

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
| **M2 — Client apps** | UX prototype (gate), design system, mobile timer UX, focus mode, idle detection, dashboard, month overview, burn-down, day list, system quick actions, absences, exports (timesheet + signable report), task estimation (baseline + own estimate; AI review rides on M3) | [#39](https://github.com/NexusHero/myDevTime/issues/39) [#11](https://github.com/NexusHero/myDevTime/issues/11) [#12](https://github.com/NexusHero/myDevTime/issues/12) [#41](https://github.com/NexusHero/myDevTime/issues/41) [#42](https://github.com/NexusHero/myDevTime/issues/42) [#13](https://github.com/NexusHero/myDevTime/issues/13) [#47](https://github.com/NexusHero/myDevTime/issues/47) [#48](https://github.com/NexusHero/myDevTime/issues/48) [#50](https://github.com/NexusHero/myDevTime/issues/50) [#49](https://github.com/NexusHero/myDevTime/issues/49) [#37](https://github.com/NexusHero/myDevTime/issues/37) [#14](https://github.com/NexusHero/myDevTime/issues/14) [#38](https://github.com/NexusHero/myDevTime/issues/38) [#90](https://github.com/NexusHero/myDevTime/issues/90) |
| **M3 — Automation & AI** | Calendar ingestion + write-back, rules engine, LLM proposals, NL entry, summaries, assistant, meeting transcription + insights, dev-tool export, Co-Planner | [#15](https://github.com/NexusHero/myDevTime/issues/15) [#43](https://github.com/NexusHero/myDevTime/issues/43) [#16](https://github.com/NexusHero/myDevTime/issues/16) [#17](https://github.com/NexusHero/myDevTime/issues/17) [#18](https://github.com/NexusHero/myDevTime/issues/18) [#19](https://github.com/NexusHero/myDevTime/issues/19) [#20](https://github.com/NexusHero/myDevTime/issues/20) [#32](https://github.com/NexusHero/myDevTime/issues/32) [#33](https://github.com/NexusHero/myDevTime/issues/33) [#44](https://github.com/NexusHero/myDevTime/issues/44) [#40](https://github.com/NexusHero/myDevTime/issues/40) |
| **M4 — Monetization** | Entitlement service, AI-credit ledger, Stripe web subscriptions, store IAP | [#21](https://github.com/NexusHero/myDevTime/issues/21) [#34](https://github.com/NexusHero/myDevTime/issues/34) [#22](https://github.com/NexusHero/myDevTime/issues/22) [#23](https://github.com/NexusHero/myDevTime/issues/23) |
| **M5 — Launch** | Security, privacy/DSGVO, observability, E2E, distribution, pricing | [#24](https://github.com/NexusHero/myDevTime/issues/24) [#25](https://github.com/NexusHero/myDevTime/issues/25) [#26](https://github.com/NexusHero/myDevTime/issues/26) [#27](https://github.com/NexusHero/myDevTime/issues/27) [#28](https://github.com/NexusHero/myDevTime/issues/28) [#29](https://github.com/NexusHero/myDevTime/issues/29) |

## Cross-cutting workstreams — start early, they don't wait for their milestone

1. **Client-stack spike** ([#1](https://github.com/NexusHero/myDevTime/issues/1)) — ✅ **done, GO
   (provisional)**: React Native + Expo confirmed ([findings](spikes/0001-client-rn-expo.md),
   scaffold `spikes/client-rn-expo`); the four risks are resolved with machine-checked evidence and
   Flutter is not triggered. One residual gate remains — the on-device checklist (C1–C7) on real
   iOS + Android hardware — before the "provisional" qualifier drops. Everything client-side
   (#11–#14, #12's background-timer work) is now unblocked.
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
M2  #39 (UX prototype, gate) ──► #11 (design system; tokens = `packages/design`) ◄─┴─────────┘
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
- Task effort estimation per [ADR-0021](adr/0021-task-effort-estimation.md) ([#90](https://github.com/NexusHero/myDevTime/issues/90)):
  the deterministic baseline + user estimate + estimate-vs-actual are hard 1.0; only the AI
  estimate **review** may degrade (baseline + history still shown) if M3 overruns — same
  assist-only discipline as the rest of the AI layer (ADR-0005).
- The Co-Planner (#40) shipped per [ADR-0011](adr/0011-ai-co-planner-and-design-language.md):
  plan entity + Day Canvas + manual timeboxing are hard 1.0; if M3 overruns, only the AI
  proposal garnish may degrade (documented fallback in the ADR) — and the shipped UI passed the
  #39 prototype gate, no design-in-code shortcuts.

## Task list to 1.0 — full status checklist

The single, consolidated list of **everything still open on the path to the first shippable
version**, so no task lives only in a PR description. It folds together (a) the open backlog
issues and (b) the design/client follow-ups that have no issue yet. Status legend: **✅ done ·
🟡 partial (some acceptance criteria met, rest open) · ⬜ open · 🔎 verify (looks delivered by
later work — confirm against the code, then close the issue)**. This list is the source of truth
for sequencing; the per-issue acceptance criteria remain the definition of done.

### M2 — Client apps

- 🟡 **#12** Mobile timer UX: today view, quick start/stop, entry editing (REQ-007) — Today
  hero + entries + editing ship; open: ≤2-tap-from-open recents, background Live-Activity/
  notification with a stop action, tablet split-view parity.
- 🟡 **#42** Idle & forgotten-tracking detection (REQ-033) — the forgotten-timer trim proposal
  ships; open: missing punch-in/out hints, device-idle signal, the "Korrekturen" inbox.
- 🟡 **#47** Month overview: activity dots per day + booking-gap markers (REQ-037) — the Month
  calendar ships (v18); open: the deterministic **gap detection** + month summary footer.
- ⬜ **#49** System quick actions: Siri/App-Intents/Shortcuts (iOS) + Quick-Settings Tile
  (Android) (REQ-039) — needs the shared headless action layer + native surfaces.
- ⬜ **#50** Classic day list: Canvas ⇄ Liste toggle with per-entry amounts + day subtotals
  (REQ-040).
- 🟡 **#90** Task effort estimation: baseline + own estimate + AI review (REQ-041) — the
  quote-from-history core ships; open: the estimation form (attribute pickers → live range),
  task estimate fields + provenance, the AI review, plan-vs-actual surfacing.
- ⬜ **#117** Vertical drag & drop for planner blocks (overlaps the v20 timegrid follow-up below).
- 🔎 **#266** Planner Month/Year utilization aggregation (REQ-046) — Month/Year views render real
  data since v18/v20; confirm the deterministic per-day/per-week load aggregation is wired, then
  close.

### M3 — Automation & AI

- ⬜ **#15** Calendar integration: Google & Microsoft OAuth, event ingestion as capture source
  (REQ-010) — the `CalendarProviderPort` + Null adapter exist; open: real OAuth + ingestion.
- 🔎 **#16** Deterministic rules engine: versioned matchers for auto-categorization (REQ-011) —
  the categorization rules engine landed (KI-1); confirm rule-CRUD UI + dry-run preview, then close.
- 🟡 **#17** LLM provider adapter + AI categorization proposals (REQ-012) — the `LlmPort` +
  proposal flow ship; open: batch "categorize my week" + confidence sort + entitlement gating.
- 🔎 **#19** AI summaries: weekly/monthly reviews & standup reports (REQ-014) — delivered by KI-3;
  confirm slot-integrity tests + standup copy, then close.
- ⬜ **#31** Spike: meeting-capture & ASR approach → **ADR-0009 Accepted** (blocks #32/#33, feeds
  #29/#34).
- 🟡 **#32** Meeting transcription pipeline: capture → ASR → stored transcript (REQ-025) — the
  consent-first notes core ships; open: the real ASR `TranscriptionPort` behind ADR-0009's winner.
- 🟡 **#33** AI meeting insights: summaries, action items, reusable prompts (REQ-026) — grounded
  insights over typed notes ship; open: reusable custom prompts + action-item → task flow.
- ⬜ **#43** Calendar write-back: mirror tracked blocks into Google/Microsoft calendars (REQ-034).
- 🟡 **#44** Dev-tool export: meeting insights & action items to Jira/Linear/Slack (REQ-035) — the
  export surface ships (KI-3); open: the real `ExportTargetPort` OAuth adapters + retry queue.

### M4 — Monetization

- ⬜ **#23** Store subscriptions: StoreKit 2 (iOS) + Play Billing (Android) with server
  notifications (REQ-018) — the entitlement service + credit ledger already back it.

### M5 — Launch

- 🟡 **#24** Security hardening baseline (REQ-019) — rate-limit hardening landed; open: the authz
  sweep test, headers/CORS, prompt-injection review, threat model.
- ⬜ **#25** Privacy/DSGVO package: export, erasure, retention, no-training matrix (REQ-020).
- ⬜ **#26** Observability & ops baseline: logging, metrics, alerts, backup/restore runbook
  (REQ-021).
- 🟡 **#27** E2E suite: golden paths across web + both mobile platforms (REQ-022) — a Playwright
  web suite runs in CI; open: the mobile matrix + the 20-consecutive-green flake gate.
- ⬜ **#28** Distribution: web launch (PWA) + App Store & Play Store submissions (REQ-023).
- ⬜ **#29** Pricing decision: free-tier limits + Pro price points → ADR (REQ-024) (blocks #28).

### Quality / foundation

- ⬜ **#152** RN/Expo on-device validation checklist C1–C7 (ADR-0004) — needs real iOS/Android
  hardware; drops the "provisional" from ADR-0004.
- ⬜ **#190** Spike: close the web accessibility / semantic-HTML gap (react-native-web) → findings
  doc; feeds #263.
- 🟡 **#263** Accessibility baseline: semantic HTML/ARIA, keyboard nav, screen-reader labels
  (REQ-043) — instrument labels + contrast are enforced; open: role mapping, keyboard operability,
  axe in the E2E tier.
- ⬜ **#265** Reports/analytics export (CSV/PDF), distinct from the timesheet export (REQ-045) —
  wires the Reports "Export — coming soon" control.

### Design/client follow-ups from v20 (no issue yet — file as they are picked up)

Landed already (PR #315): Toast + confirmation toasts, the Planner "View" popover, the in-bar
start-picker, the FullCalendar web seam (ADR-0068), and default-screen → Planner. **Still open:**

- ⬜ Planner **Day-view canvas** (tracker row + instruments rail) — "Today" as the day stage of
  the Planner.
- ⬜ FullCalendar **week/day timegrid** with drag & resize (web); native drag/drop is #117.
- ⬜ "+ New" extended to **five typed entries** (Task, manual actual, Meeting, Travel, Life) +
  richer actual/meeting/life drawers (rebook, ±15-min nudge, rate/billable, duplicate, attachments,
  action-items, partner Free/Busy request).
- ⬜ Empty-slot tap-to-create · KW ‹ › navigation · conflict/overflow banners · all-day banner +
  evening zone.
- ⬜ **Travel** block type on the canvas (route/km/mode, half-rate billable) — needs the billing
  backend touch (project rates → revenue, travel type).
- ⬜ Today **AI moments** (drift→replan, protected-time digest, richer draft queue, hero
  autocomplete, auto-tracker booking proposal, plan-adherence chip, idle window) + Today header
  status chips.
- ⬜ D14 protected-time nudge relocation (bottom-centre, ~8 s after clock-in).

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
