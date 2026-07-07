# ADR 0011: AI Co-Planner in 1.0 + a Binding UX Vision Before Component Code

## Status

Accepted — extends the 1.0 scope union (ADR-0002/0008/0010) and adds a process gate to the
client track. (The pricing ADR from #29 moves to the next free number.)

## Context

Owner decision (2026-07-06), two parts:

1. The product's design must be strong enough to *switch* Tyme users, not merely accompany the
   feature list — "revolutionär" as ambition, applied with discipline.
2. The app should be a **Co-Planner** for the developer: not a logbook that records what
   happened, but a co-pilot that proposes the day, shows drift live, and reviews the evening —
   the piece that makes "ultimatives KI-gestütztes Management-Tool von Zeit und Meetings" more
   than a feature list. Neither Tyme (records only) nor Tactiq (meetings only) has this.

Until now the repo had functional screen criteria (#11–#13) but no design direction, and no
planning concept at all. Building components before settling the design language would bake in
mediocrity; bolting planning on later would fight the Day-Canvas-less information architecture.

## Decision

- **UX vision as a binding document:** [`docs/design/ux-vision.md`](../design/ux-vision.md)
  defines the principles (time as material, capture cheaper than not capturing, plan+reality on
  one surface, calm AI, keyboard-first/thumb-first), the signature elements (**Day Canvas**,
  **Co-Planner briefing/review**, **Island**, **command palette**, instrument-style stats), the
  IA, and the visual/motion language. A **prototype gate**
  ([#39](https://github.com/NexusHero/myDevTime/issues/39)) validates it with users **before**
  the design system (#11) hardens tokens/components — design settles in the prototype, not in
  component code.
- **AI Co-Planner is 1.0 scope** (REQ-031,
  [#40](https://github.com/NexusHero/myDevTime/issues/40)): a versioned **plan entity** distinct
  from actuals; a **deterministic planning algorithm** (meetings anchor, focus blocks fill by
  deadline/budget/target-hour pressure, breaks satisfy the rules) with the LLM only
  ranking/labeling/explaining within code-enforced candidates (ADR-0005 discipline; 1 briefing
  = 1 credit, #34); proposals as ghost blocks; plan-vs-actual live and as evening review feeding
  the standup (#19).

## Consequences

- The client track gains one gate: #39 blocks #11. Worth it — reworking components is far more
  expensive than reworking Figma frames.
- The Day Canvas becomes the app's hardest UI and is added to the client spike's (#1)
  proof-of-quality scope (gesture/animation fidelity in RN) — a second chance for the Flutter
  fallback to trigger, honestly faced now rather than discovered in M2.
- Plan data enriches the AI grounding surface (assistant #20 and summaries #19 can reference
  intentions, not just facts) at zero extra AI machinery; the accept/adjust/dismiss stream is
  the post-1.0 learning-loop's training data, captured from day one.
- The Co-Planner is optional by design: non-planners lose nothing, so the feature can't hold
  the tracking core hostage in reviews or in the schedule — if M3 overruns, ghost-block
  *proposals* can degrade to manual timeboxing (plan entity + canvas stay 1.0; the AI garnish
  rides the credit system whenever it lands).
- Marketing claim discipline: "revolutionary" attaches to the Co-Planner concept and canvas
  interaction — the rest of the UI stays deliberately conventional (novelty budget spent once).
