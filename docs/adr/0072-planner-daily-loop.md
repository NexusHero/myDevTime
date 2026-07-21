# ADR 0072: The planner's daily loop — one-tap day repair, backlog rail, calm canvas

## Status

Accepted (owner decision, grill session 2026-07-21) — **bound by ADR-0005** (deterministic core:
the reflow packing and every figure it shows are pure, exhaustively tested logic in
`packages/domain`; the LLM refines estimates only as a marked proposal and is never in the
packing path) and **ADR-0071** (every plan mutation flows through the one **plan-apply seam** —
confirm-only, a new accepted plan version, nothing auto-booked; Sevi's nudge budget and 🛡
gating stay authoritative). Extends the Co-Planner of **ADR-0011**, the reality layer/drift work
of **ADR-0062**, the capacity-honesty ethic of **ADR-0066 §F**, the issue import of
**ADR-0070** and the task estimation of REQ-041. Supersedes nothing; ADR-0068 (FullCalendar on
web) stays in place.

## Context

The planner is functionally broad — week canvas with drag/resize, Co-Planner ghosts, reality
layer, capacity head-trace, layer filter, recurrence, Sevi plan advisory — yet the owner's
honest verdict in the grill session was that **all three** daily-flow breaks are real, and that
they form **one broken loop**, not three feature requests:

1. **Filling the week takes too long** — *because* the backlog bridge is missing: tickets live
   in GitHub/ADO/one's head, the planner shows time but not the work, so building a week is
   click-and-drag labour.
2. **The plan dies at noon** — the first disruption invalidates the rest of the day, and
   re-planning costs as much as planning, so the plan is abandoned. The drift chip *shows* the
   break but does not *help*.
3. **Because of 1 + 2, the habit never forms** — and the owner fixed the product's single
   success metric as **daily voluntary use**. A planner opened out of duty is a failed planner.

The competitive frame was decided as a deliberate mix: **Motion's** self-repairing plan +
**Sunsama's** daily ritual + our own **dev-week league** (tickets, PRs, meetings, focus time in
one weekly picture) — explicitly *not* the pure-speed league. On design, the gaps ranked:
**density/readability** at real data volumes, the **dead-wall first run**, and **interaction
haptics**; the web/mobile split (ADR-0068) was explicitly *not* the pain.

## Decision

### D1 — One-tap day repair (the noon fix, built first)

A pure **`planner/reflow`** core in `packages/domain` computes, from the accepted plan, the
clock, the missed/overrun blocks, the day's capacity line and the fixed obstacles (meetings,
🛡 protected times), a **re-layout of the remainder of the day as a ghost proposal**. One tap
applies it through the plan-apply seam (new accepted plan version). **The plan never moves
without a tap** — Motion's silent reflow is rejected; ADR-0005/0071 stand unamended.

**Stretch is allowed, as an informed deal ("bewusster Preis + Ruhe"):** the reflow may lay
work past the personal capacity line into the evening, but

- the proposal states its price *before* the tap — e.g. `+90 min über deiner Linie ·
  Feierabend ~19:30` — computed deterministically;
- a conscious accept **acknowledges the stretch for the rest of that day**: the own-baseline
  tier of Sevi's live-load watch treats the accepted overrun as chosen, not drifted into, and
  stays quiet about it (a scoped acknowledgment input to the nudge policy — *not* a global
  mute; new signals such as a break shortfall still speak);
- the **universal ArbZG hard caps stay inviolable**: the reflow never proposes past the ~10 h
  day or into legally required breaks. Work that does not fit under the caps moves **visibly**
  to tomorrow/the backlog — the repair tells the truth instead of hiding overflow.

**Where it lives:** the existing drift chip *becomes the action* — `Plan gerissen · Reparieren`
on Today and in the planner's day view. No new surface; the indicator becomes the handle. Sevi
mentions the repair only within its existing nudge budget and gates (ADR-0071 P2).

### D2 — Backlog rail + "Fülle meine Woche" (the morning fix)

A dockable **backlog rail** beside the week canvas lists imported issues (ADR-0070,
proposal-only as ever) and own tasks, each rendered at its estimated size. Two grips:

- **drag one** ticket onto the canvas (full control), or
- **one shot — "Fülle meine Woche":** a deterministic packing (priority, estimate, remaining
  capacity, honouring meetings/🛡/absences) lays the whole rail into the week **as ghosts**;
  one confirm books them through the plan-apply seam.

**Estimates:** an unestimated ticket packs at a **deterministic 60-minute default**; the AI
estimation (REQ-041) *refines* it as a visibly violet proposal with provenance — the packing
result is reproducible without a provider, credits are spent only on a real LLM call, and the
feature degrades to the default when the provider is down (ADR-0005/0029).

### D3 — The calm canvas (one redesign, not a menu)

Density, first run and haptics are fixed as **one package**, gated on a before/after artifact
the owner approves before implementation lands:

- **Ruhe als Default:** the week shows only the accepted plan and the now-line. Reality,
  ghosts, life shades and the capacity trace are one tap away behind layer chips — never all
  loud at once. Progressive disclosure becomes a binding rule (ux-vision §2.8).
- **Block redesign:** stricter type hierarchy, project colour as an edge instead of a fill,
  and four unmistakable states — planned / live / done / missed.
- **Time compression:** empty edge hours (roughly 0–7 and 20–24, when unplanned) collapse, so
  the visible week is the lived week and blocks gain height.
- **Sevi first run:** an empty planner is Sevi's stage, not a dead wall — two or three
  questions ("Wann fängst du an? Woran arbeitest du heute?") produce the first ghost week via
  the plan-apply seam; the empty state *is* the onboarding and demonstrates the core magic
  (proposal → one tap → plan). No demo/mock data (honesty rule stands).

### D4 — Metric and sequencing

The milestone's metric is **daily voluntary use**; plan-adherence and repair usage are
surfaced (existing adherence chip) but are diagnostics, not the goal. Build order is strict:
**Slice 1 repair → Slice 2 rail → Slice 3 redesign**, each shippable alone.

## Consequences

- Two new pure domain modules (`planner/reflow`, `planner/packing`) under the ≥90 % coverage
  bar; both must be property-tested against capacity/caps invariants (never past hard caps,
  never over a 🛡 block, idempotent re-run on an unchanged day).
- The nudge policy gains a **scoped stretch-acknowledgment** input (day-local); its
  interaction with the daily budget and 🛡 stays pure and tested (extends REQ-067/068 logic,
  no schema break).
- The plan-apply seam gains two new proposal producers (repair, fill-week) — same confirm-only
  contract, provenance `planner-reflow` / `planner-fill` on every applied version.
- The redesign touches only presentation + the design package (tokens/layout helpers held to
  the coverage bar); ADR-0068's web FullCalendar stays, restyled to the same calm default.
- Risks accepted: the 60-minute default will misfit some tickets (mitigated by violet
  refinement + drag-resize); stretch-acknowledgment must not become a habit-forming loophole —
  Sevi's *weekly* pattern view still counts stretched days against the baseline trend.

## Requirements

REQ-072 (one-tap day repair) · REQ-073 (backlog rail + fill-week) · REQ-074 (calm canvas +
Sevi first run) — see the register in `docs/architecture.md`.
