# ADR 0060: Balance card — deterministic strain signals + local-only OLBI check-in

## Status

Accepted (owner decision) — **extends [ADR-0012](0012-competitive-feature-adoption.md)**
(the Balance/Focus feature frame) and is bound by the deterministic-core rule
([ADR-0005](0005-deterministic-core-llm-assist.md)) and the "Balance-Feature-Ethik" stance
(a workload signal, never a diagnosis). Realizes the full **Balance** card of
design-handoff v10 (§Balance) for REQ-032.

## Context

The Today header already carries the slim Balance signal (focus streak + a neutral
`workloadLoad` chip). Design v10 specifies the **full Balance card** on Reports: a
passive half computed from the user's own tracked time (a workload meter, a 10-week
focus trend, a day-length distribution) paired with a self-report half — a weekly
**OLBI short-form** check-in (exhaustion + detachment, two 1–5 items). The design's
thesis is explicit: *self-report × work data is the honest signal; neither alone*, and
it is **a signal, never a diagnosis**.

The self-report is **sensitive wellbeing data** — OLBI items are burnout-adjacent
(GDPR Art. 9 territory). The design's own CheckinCard states the contract to the user
on screen: *"stays on your device."* Storing it server-side — especially "per
workspace", where an employer controls the workspace — would break that on-screen
promise and reopen the § 26 BDSG / works-council / special-category exposure that the
Auto-Tracker was deliberately kept local for (ADR-0057). The owner, after this was
surfaced, chose **local-only**.

## Decision

Ship the Balance card with a **deterministic passive half** and a **local-only
self-report half**.

1. **Passive signals are the deterministic core's (ADR-0005).** Two pure helpers join
   the existing `DayFocus` model in `packages/domain/insights/balance.ts`:
   `weeklyFocusTrend(days, weeks)` (trailing weekly focus minutes, anchored on the last
   day so the math is clock-free — the sparkline) and `dailyHoursDistribution(days)`
   (five-number summary of active days' focus minutes — the box plot; `null` under a
   `minDays` floor so too little data shows an honest empty state). The client
   `buildBalance` composes them with the existing `workloadLoad` over the same
   summary/absence/worktime read models the Today chip already uses. Every number is the
   core's; nothing is fabricated, and with no tracked time the card shows its empty state.

2. **The self-report check-in is local-only by contract.** The weekly OLBI answers are
   written **only** to an on-device store (`apps/mobile/src/insights/checkinStore.ts`,
   the same cross-platform `localStorage`/in-memory seam as `onboardingStore`/
   `timerStore`) and **never sent to the server** — no endpoint, no table, no migration.
   The card renders the promise ("stays on your device"), asks at most once per week
   (keyed on the week's Monday), and collapses to a one-line confirmation once answered.

3. **Neutral framing, never a diagnosis.** The card is titled from the user's *own*
   tracked time and labelled "a signal, never a diagnosis"; the workload meter uses the
   neutral calm/steady/elevated band; no comparison to other people, no clinical verdict.

## Consequences

- **Pros**: the full v10 Balance card ships with every passive figure computed by the
  tested deterministic core; the honest self-report half is included without creating a
  special-category data surface — no server storage, no consent/DPIA burden, and the
  on-screen privacy promise is kept. Data-minimization (Art. 5(1)(c)) and
  privacy-by-design (Art. 25) hold by construction.
- **Cons / limits**: the local-only check-in does **not** sync across a user's devices
  and is lost if local storage is cleared — an accepted trade for keeping burnout
  self-report off any server. Cross-device sync would require explicit Art. 9 consent
  and a new ADR; it is intentionally out of scope.
- **Reversible**: the passive helpers are additive pure functions; deleting the
  `checkinStore` + `CheckinCard` wiring removes the self-report half with no schema or
  server impact.
