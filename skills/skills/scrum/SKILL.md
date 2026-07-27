---
name: scrum
description: How we run delivery on SteuerEule — Scrum with 1-week sprints, the Planning/Review/Retrospective ceremonies, WSJF + MoSCoW + dependency prioritization, the GitHub Project board as the single backlog, and the live ticket-state rule. Pairs with the ultimate-dev-process Definition of Done. Use when planning a sprint, prioritizing the backlog, running a ceremony, or deciding what to build next.
---

# How we work — Scrum on SteuerEule

Solo/portfolio delivery. We keep Scrum's **artifacts** and **ceremonies** and trim the rest to what
produces value for one person. This skill is the *method*; the **backlog lives on the board**
(GitHub Project **SteuereuleBoard**), not in a file. Definition of Ready/Done and every quality gate
come from [`ultimate-dev-process`](../ultimate-dev-process/SKILL.md) — this skill does not repeat them.

## Cadence

- **Scrum, 1-week sprints.** Each ends with a demo-able increment against the real artifact.
- **Product Goal:** the broad Product 1.0 (full ADR vision), reached **incrementally, core-first** —
  no big-bang.

## The backlog lives on the board

- **The board is the single backlog.** Epics, features and tasks are **GitHub issues**; there is no
  backlog markdown file to drift out of sync.
- **Hierarchy via sub-issues:** `Epic → Story/Feature → Task`. An Epic issue is titled `[Epic] EN — …`;
  stories/tasks are sub-issues of it (and of each other) so the tree is navigable on the board.
- **Progressive refinement:** only the **current sprint** is decomposed into task issues. Future epics
  stay coarse (one Epic issue) and are broken down just-in-time at Planning — never refine the whole
  backlog upfront (YAGNI).
- **The Requirements Register** (`docs/requirements/register.md`) tracks delivered `REQ-NNN`s and their
  acceptance tests; the board is where work is *discussed and moved*, the Register is the *source of
  truth for what shipped*.

## Prioritization — WSJF + MoSCoW + dependencies

1. **Dependency-first** is a hard constraint (you can't build the breadth before the core loop).
2. **WSJF** orders the unblocked: `WSJF = (Business Value + Time Criticality + Risk-Reduction/
   Opportunity-Enablement) ÷ Job Size`, relative Fibonacci (1–13); higher = sooner.
3. **MoSCoW** tags (`Must`/`Should`/`Could`/`Won't`) fence scope *within* 1.0, so under time pressure
   it's clear what falls first without losing the goal.

Each Epic issue carries its `MoSCoW · WSJF · Depends on · Gate` line. **Gates** (ELSTER certificate →
real submission; data-protection clearance → AI in production) defer the *gated scope*, not the whole
epic.

## Ticket state is always live

Per ultimate-dev-process §6: move the ticket the **moment** its state changes — `In progress` when
work starts (branch cut / first commit), `In review` while the PR is open, closed/`Done` only once
merged after the PR. The ticket, its Register row and its PR are always in agreement. A lagging board
state is a process defect.

## Ceremonies — run every sprint, recorded on the board

Each sprint has one **Sprint tracking issue** on the board — `Sprint NN — <goal>` — with three
sections filled across the week. (Ceremonies are recorded *on the board*, not in files.)

### Sprint Planning — start
- Write **one Sprint Goal** (a single sentence: the demo-able increment).
- Pull the top backlog items (WSJF order, dependencies respected) into the sprint; decompose them into
  **task sub-issues**, each meeting the Definition of Ready (§0).
- Record the goal + committed items in the Sprint issue's **Planning** section.

### Sprint Review — end
- **Demo the increment against the real artifact** (the shipping container image, §3.5) — not slides.
  Every completed `REQ-NNN` is shown fulfilling its acceptance criterion.
- Update the Requirements Register statuses and the board (shipped / carried over / newly discovered).
- Record it in the Sprint issue's **Review** section.

### Sprint Retrospective — end, after Review
- Reflect on the **process**, not the product: went well · to improve · to try.
- **Every improvement becomes a tracked action-item issue** (§6) — owned, prioritized into a later
  sprint. A retro with no action items didn't land. Postmortem items (§8.1) surface here too.
- Record it in the Sprint issue's **Retrospective** section.

## Velocity

After ~2 sprints, average completed points/sprint is the **velocity**; the roadmap is re-forecast
against it. Until then, any roadmap is an explicit guess, not a commitment.

## The loop, per feature

`grill-with-docs` (sharpen + ADRs, §0.1) → Planning (pull + decompose) → TDD/ATDD build → `code-review`
(§11) → Review (demo) → Retro (improve). Every feature is bookended by a skill.
