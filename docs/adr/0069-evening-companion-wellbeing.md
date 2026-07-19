# ADR 0069: Evening Companion — one grounded, caring day-in-review over a deterministic wellbeing core

## Status

Accepted (owner decision) — **bound by ADR-0005** (deterministic core: every number the
companion states is computed in `packages/domain`; the LLM only narrates, never invents a figure
and never books) and **ADR-0029** (the one agnostic LLM port; degrade to a deterministic template
when the provider is down). Extends the Co-Planner / evening-review of **ADR-0011** and reuses the
capacity/health baseline concepts of **ADR-0066**. Supersedes nothing.

## Context

The product already carries the *ingredients* of a caring assistant — the punch-out **MoodCheck**,
the **Feierabend/shutdown** ritual, the **Balance** card with a personal baseline band, the
**overload / ArbZG break-shortfall** warnings, plan-adherence drift — but they are **fragmented**:
a card here, a chip there. There is no single evening voice that looks at the whole day and says,
warmly, *"today was heavy — the third long day this week; want me to protect tomorrow morning?"*,
and no longitudinal model of the person ("your normal", "you overbook Mondays").

The risk in closing that gap is obvious: a "wellbeing assistant" that fabricates a stress number,
diagnoses, or silently reschedules the user's day would violate both trust and ADR-0005.

## Decision

A single **Evening Companion** feature, built as **deterministic core → grounded narration → one
Today card**, proposal-only throughout:

1. **Deterministic wellbeing core** (`packages/domain/src/wellbeing`, ≥90 % tested, pure, no clock/IO):
   - `reviewDay(input)` folds the day's already-computed signals (planned vs actual minutes,
     overtime, break shortfall, meeting count + back-to-back, mood 1–5, plan drift, absence flag)
     into a **banded** load level `light | normal | heavy | overload` and a set of structured,
     human-meaningful `WellbeingSignal`s (`long-day`, `overtime`, `break-shortfall`,
     `back-to-back-meetings`, `meeting-heavy`, `plan-overrun`, `low-mood`). A signal that can't be
     computed from the input is **absent, never guessed**; an absence day short-circuits to `light`.
   - `computeBaseline(days)` gives the person's **own** normal band (mean ± spread), a trend, and
     deterministic pattern flags (`consecutive-heavy-days`, `weekday-overbook`). Too little history →
     a wide band and no flags (never judge without enough own data — the ADR-0066 ethic).
2. **Grounded narration** (`apps/api` `POST /api/ai/evening-companion`, behind the auth guard):
   runs the core (free, always), then asks the one LLM port for a warm one-paragraph summary + **one**
   gentle forward suggestion, grounded strictly in the core's facts. The suggestion's `kind` is
   always chosen deterministically from the top signal — only its *phrasing* is the model's, and its
   provenance is always `ai-proposal`. Credit is debited **once**, and **only** when the narration is
   a real `ai-proposal`; provider-down / no-credits / absence-day degrade to a caring deterministic
   template built from the same signals — free.
3. **One Today card** (`EveningCompanionCard`): gathers the day's real signals from what Today
   already holds (planner review, meetings; overtime/break/mood honestly omitted where there is no
   feed yet), and renders the band + week-trend + top signals + the warm message with honest
   provenance (`ai-proposal` "1 credit used" vs `deterministic` free). The one suggestion is a
   **proposal** confirmed in the Planner (protected-time / re-plan) — **nothing is auto-booked**.

## Consequences

- **Trustworthy by construction:** the companion can only ever *narrate* numbers the deterministic
  core produced; it cannot invent a stress score or reschedule the day on its own. It degrades to a
  caring, free template when the LLM is unavailable.
- **Reuses, doesn't duplicate:** it weaves the existing MoodCheck / Feierabend / Balance /
  plan-adherence signals into one voice rather than adding a parallel system, and reuses the
  own-baseline ethic already established for capacity/health.
- **Honest gaps (deferred, tracked in REQ-065):** a *persisted per-day load-score series* is needed
  for a rich baseline (Today has no series yet, so the baseline stays wide/steady); a worktime/mood
  feed is needed to populate the overtime/break/mood signals from Today; and an e2e acceptance test
  is outstanding. None of these are faked in the meantime — the missing signals are simply absent.
- **Cost:** one credit per AI-narrated evening summary (never for the deterministic parts), on the
  existing ledger — visible and gated like every other AI surface.
