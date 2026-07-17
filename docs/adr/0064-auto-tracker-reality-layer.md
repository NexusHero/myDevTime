# ADR 0064: Auto-tracker reality layer — timestamped local day history + deterministic drift/gap core

## Status

Accepted (owner decision) — **extends ADR-0057** (auto-tracker aggregation) and
ADR-0058/0059 (native/desktop capture); realizes the Planner reality companions of
ADR-0063 (K1 reality trace + drift chip, K3 yesterday-healing). Bound by ADR-0005
(deterministic core; AI/observation proposes, the user books). This ADR lands the
deterministic core (part 1); the client persistence and the Planner UI follow.

## Context

The auto-tracker (ADR-0057) captures "app usage while tracking" and shows a **live,
session-scoped** breakdown on Today. Its persisted model is merged-by-source totals
(`{source, ms}`) in a single browser `localStorage` key, **wiped at session end**, with
**no timestamps and no day dimension** (map: `apps/mobile/src/autotracker/activityStore.ts`).

The calendar-centric IA (ADR-0063) asks for two things the current model cannot feed:
- **K1 — a reality trace + drift chip** on the Planner: what the tracker saw, positioned
  on the day timeline, and how far it drifted from what was booked.
- **K3 — yesterday-healing**: on first open, offer to book the largest stretch the tracker
  saw yesterday but that was never booked.

Both need **timestamped spans** and **per-day history that survives session-end** —
neither exists today. ADR-0058/0059 deliberately rejected *server* ingest of activity on
data-protection grounds (burnout/surveillance-adjacent Art. 9 risk).

## Decision

1. **Deterministic reality core (this PR)** — `packages/domain/src/autotracker/reality.ts`,
   pure and framework-free (ADR-0005), held to the ≥90 % bar:
   - `TimedSpan { source, startMs, endMs }` — a captured span with wall-clock bounds
     (the timestamped shape the current model lacks).
   - `trackedMs(spans, opts)` — real-work total, **Idle/Away excluded** by default.
   - `realityDrift(spans, bookedMs)` → `{ trackedMs, bookedMs, deltaMs }` (signed;
     positive = tracker saw more than was booked). Drives the day-head drift chip.
   - `detectUnbookedGap(spans, booked, {minGapMs})` → the **single largest** unbooked
     active stretch (`RealityGap`), labelled by dominant source, or `null`. Drives the
     yesterday-healing banner (max one, floor of `minGapMs`). Pure interval math.
2. **Persistence stays local, gains a day dimension + timestamps (follow-up PR).** The
   session store is extended to a **per-day, timestamped, local** history (bounded to a
   few recent days), keyed by `dayKey`. This is *not* a reversal of ADR-0058/0059: the
   data never leaves the device — no server table, no upload — it only stops being wiped
   at session end so "yesterday" exists. Consent is unchanged: capture and history are
   gated on `prefs.autoTracker` and an active timer, exactly as Today does today.
3. **Observation proposes, never books (ADR-0005).** The reality trace is a read-only
   overlay; drift is a number, not an action; healing is a *proposal* the user adopts with
   an undo. Nothing the tracker sees is ever auto-booked.

## Consequences

- **Pros**: the Planner can show plan *and* reality on one surface (the product's §2.1
  promise) from real captured data; the drift/gap logic is pure and exhaustively testable
  with no device or clock; no new privacy surface — history stays on-device, consent-gated.
- **Cons / limits**: web own-tab capture only sees *this tab's* Active/Idle/Away, so the
  "reality" on web is coarse (real OS/app attribution needs the native module / desktop
  companion, still unverified per ADR-0058/0059); the local day history is best-effort and
  device-local (it does not sync across devices — a deliberate privacy choice). When no
  activity was captured, every reality surface shows an honest empty state, never a guess.
- **Docs**: REQ-042 in the register notes the reality core; ux-vision §2.6 already frames
  the reality layer. Follow-up PRs land the day-history store, the K1 trace/chip, and the
  K3 banner.
