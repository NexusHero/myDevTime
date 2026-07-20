# ADR 0071: Sevi — a proactive care buddy over a deterministic live-load core

## Status

Accepted (owner decision) — **bound by ADR-0005** (deterministic core: *when* Sevi speaks is
decided by pure, exhaustively tested logic in `packages/domain`; the LLM only phrases, never
invents a figure and never books) and **ADR-0029** (the one agnostic LLM port; degrade to a
deterministic template when the provider is down). Extends the Evening Companion of **ADR-0069**,
the capacity/health-baseline ethic of **ADR-0066** (H3 — *your own* normal, never a fixed
threshold), the Co-Planner of **ADR-0011**, and the 🛡 protection flag of **ADR-0066/REQ-057**.
Supersedes nothing.

## Context

myDevTime already carries a surprising amount of *caring substance* — the punch-out **MoodCheck**,
the **Feierabend/shutdown** ritual, the **Balance** card with a personal baseline band, the
**overload / ArbZG break-shortfall** warnings, plan-adherence drift, and (ADR-0069) an **Evening
Companion** that weaves the day's signals into one warm voice. But it behaves like a *tracker that
occasionally reflects*, not like a **buddy who looks out for you**:

1. **It is silent until you open it.** Every nudge is an in-app banner, visible only while the app
   is foregrounded. There is **no** proactive channel (a grep for `expo-notifications` /
   `scheduleNotification` returns zero files). A friend who only speaks when you call them is not
   watching your back.
2. **Your mood is thrown away.** The punch-out MoodCheck captures Good/Tense/Stressed and then
   **discards** it (only `onDone` is wired, no persistence). The `low-mood` signal path exists in
   the wellbeing core but is never fed. The weekly OLBI check is, by contract, device-local only.
3. **The Co-Planner ignores your health.** It plans from tasks + calendar + a *fixed* 90/15 break
   rule; the wellbeing baseline, load trend, energy and recovery never enter the plan. The Evening
   Companion's forward suggestion ("protect tomorrow morning") has **no wiring back into the plan** —
   the user must act on it by hand.
4. **The vision never says "care".** `docs/design/ux-vision.md` has no buddy/health/care principle;
   the caring stance lives only in code and in scattered REQs, so it is not a binding review gate.

The owner's intent, stated plainly: Sevi should be a **pair-partner / Scrum-Master for your load** —
one who, at planning time, asks *"aren't you taking on too much?"*, who *while you work* watches that
you don't overwork, and who does this for **life as well as billable work** — reaching out **only
when it looks hard**, never nagging.

The risk in closing this gap is the same one ADR-0069 named, now sharper because Sevi speaks
*proactively*: a buddy that fabricates a stress number, diagnoses, nags, interrupts protected time,
or silently reschedules the day would destroy trust and violate ADR-0005. Proactivity multiplies
both the value and the harm, so the guardrails must be structural.

## Decision

Grow the fragmented caring signals into **one named presence, "Sevi"** (the existing mascot,
ADR-0061), built as **deterministic trigger core → grounded phrasing → gated delivery**,
proposal-only throughout. Four principles are non-negotiable and enforced by construction:

### P1 — Silent by default; the *decision to speak* is deterministic (ADR-0005)

A new pure core `packages/domain/src/wellbeing/liveLoad.ts` computes an **intraday live-load** from
the already-deterministic worktime feed (hours worked today · continuous focus since the last
break · back-to-back-meeting streak · overtime accrued today) into an **escalation level**
(`calm | watch | speak-up`) plus typed, human-meaningful reasons. The `speak-up` boundary is:

- **primarily relative to the person's own baseline** (`computeBaseline`, ADR-0066 H3 — "clearly
  above *your* usual", never a fixed 8-hour number), **plus**
- **a few universal hard caps** that hold regardless of baseline, because some lines are red for
  everyone: ArbZG **>6 h worked with no break**, **approaching the 10 h daily maximum**, and
  **several heavy days in a row** (the existing `consecutive-heavy-days` flag).

The hard-cap set is deliberately tiny and legally grounded (ArbZG §4/§3, a *hint*, not
certification — consistent with `attendance/break-rule.ts`). Everything else is your own band, so
Sevi neither ignores a chronically-overloaded "normal" (the caps catch it) nor treats a single
busy-but-fine day as an emergency (the band absorbs it). **Whether** Sevi speaks is 100 % this core;
the LLM is never in that path.

### P2 — Proactive, but calm and gated (ADR-0066 🛡, quiet hours)

A narrow **`NotificationPort`** (ports-and-adapters, skill §2.2) confines any push/OS-notification
SDK to a single adapter, with a **`NullNotification`** default so a deployment without the vendor
degrades to in-app-only, never crashing. First adapter is **local/scheduled notifications** (Expo,
on-device, no server-push infrastructure, works offline) — enough for "time for a break" /
"nearing Feierabend"; server-push for cross-device is a later, separately-ADR'd step. Delivery is
**gated by a pure policy** (`wellbeing/nudgePolicy.ts`): suppressed entirely during a 🛡 **protected
block** and during the user's **quiet hours**, **rate-limited to at most 1–2 voices per day**, and
**opt-in** (off until the user turns Sevi's proactivity on). A suppressed `speak-up` is optionally
folded into **one** later digest (the REQ-057 "hold nudges, one digest after" rule), never a queue
of missed pings. Sevi is proactive the way a good colleague is: a tap on the shoulder when it
counts, silence otherwise.

### P3 — Consented, deletable memory; never a diagnosis (ADR-0066 ethic)

To recognise patterns ("Tuesdays often tense", "low-mood → plan a lighter day") Sevi needs memory.
The punch-out MoodCheck value is finally **persisted — but only under explicit opt-in consent**
(REQ-025 pattern), server-side (so the grounded companion can weave mood over weeks and across
devices), **never shared, exported, or paywalled**, and **erasable in one action** (delete the whole
mood history). Mood extends the existing workspace-scoped `wellbeing_days` store (idempotent upsert
per (workspace, user, day)); with consent off, mood stays **honestly absent**, exactly as today —
no silent capture. Sevi states bands and signals ("heavy day", "third long day this week"); it
**never** labels the person (no "burnout score", no clinical language) — the ADR-0066 "never a
diagnosis" rule is binding.

### P4 — Sevi is a two-way presence, and its suggestions can act *only* by proposal

Sevi is **one voice across all four moments** — planning (Scrum-Master), mid-work (overwork watch),
evening (the ADR-0069 companion), and life — reachable **two-way** through the existing Assistant
overlay ("bin platt, mach mir den Tag leichter"). To make the Scrum-Master real, a **plan-apply
seam** lets a Sevi suggestion (e.g. "protect tomorrow morning", "move a block") become an actual
plan/protected-time mutation — but **only** as a proposal the user confirms; nothing is ever
auto-booked (ADR-0005). Sevi's *phrasing* is the LLM's (grounded strictly in the core's facts,
provenance always `ai-proposal`, one credit only on a real narration, free deterministic template
when the provider is down); Sevi's *decisions and numbers* are always the deterministic core's.

### Scope, sequenced (one vertical slice per PR)

- **REQ-067 — Live-load trigger core** + **REQ-068 — consented mood store** + **REQ-069 —
  NotificationPort (local, Null default)**, shipped together as **Slice 1** with the **real-time
  overwork watch** as the first visible Sevi moment.
- **REQ-070 — Scrum-Master at planning time**: the over-commitment voice + the plan-apply seam.
- Mood-pattern awareness (weekday patterns, low-mood softens the plan) rides on REQ-068's store.
- **REQ-071 — life care**: Sevi actively protects `--life` blocks, notices you never keep an
  evening free, and encourages rest days (builds on the `--life` token, ADR-0066 §F).

## Consequences

- **Trustworthy by construction, even while proactive.** Sevi can only *narrate* numbers the
  deterministic core produced, can only speak when that core says `speak-up`, and can only be
  delivered through a policy that honours 🛡, quiet hours, opt-in and a daily cap. It degrades to a
  caring, free, in-app template when the LLM or the notification vendor is unavailable.
- **Reuses, doesn't duplicate.** Sevi weaves MoodCheck / Feierabend / Balance / Evening-Companion /
  plan-adherence into one presence rather than adding a parallel system, and reuses the own-baseline
  ethic (ADR-0066) and the one LLM port (ADR-0029). The mascot (ADR-0061) becomes the buddy's body.
- **New volatile dependency, properly confined.** OS/push notifications are a classic vendor risk;
  the `NotificationPort` + `NullNotification` keep the SDK in one adapter and let everything upstream
  stay pure and testable. Server-push (APNs/FCM/Expo push) is explicitly deferred to its own ADR.
- **Privacy posture is explicit and reversible.** Mood — the most sensitive datum — is opt-in,
  deletable, never shared/exported/paywalled; the default remains "not stored". This is a deliberate,
  documented reversal of REQ-065's "mood deliberately not stored" *only* under consent.
- **Health is never paywalled.** Consistent with REQ-056, Sevi's care surfaces (load watch, break
  nudge, balance) are visible in every tier; only the *LLM phrasing* of a suggestion is credit-metered,
  exactly like every other AI surface — the deterministic care is always free.
- **Cost:** one credit per AI-*phrased* Sevi message (never for the deterministic trigger, the
  break nudge, or the template), on the existing visible ledger.
- **The vision gains a gate.** `ux-vision.md` gets a binding Care/Buddy principle, so UI that nags,
  diagnoses, interrupts protected time, or books on the user's behalf now *fails review*.
