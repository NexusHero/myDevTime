# myDevTime — UX Vision & Design Language

Status: **Guiding document** — validated and refined by the prototype issue
([#39](https://github.com/NexusHero/myDevTime/issues/39)), implemented by the design system
([#11](https://github.com/NexusHero/myDevTime/issues/11)). Product scope for the Co-Planner is
[ADR-0011](../adr/0011-ai-co-planner-and-design-language.md).

The competitive bar is explicit: Tyme owns "beautiful native time tracking", Tactiq owns
"effortless meeting AI". We don't out-feature them screen by screen — we win on a **concept
neither has**: the app is not a logbook, it is a **Co-Planner** for the developer's day. Every
design decision below serves that.

---

## 1. Design principles (the five tests every screen must pass)

1. **Time is material.** Time renders as something you can *touch*: blocks on a canvas that you
   drag, stretch, split, and merge — not rows in a form. If a screen shows time as a table where
   a canvas would do, it's wrong.
2. **Capture must be cheaper than not capturing.** ≤ 2 taps or one command for anything frequent
   (start timer, punch, break, NL entry). The app never asks for what it can infer (project from
   context, duration from gap) — it *proposes* and the user confirms.
3. **Plan and reality share one surface.** The signature view is the **Day Canvas**: the plan
   (ghost blocks) and the actuals (solid blocks) on the same timeline. Drift is *visible*, not a
   report you look up later.
4. **Calm AI.** AI output is always visually distinct (ghost/outline style + provenance chip),
   never moves data by itself, and disappearing it costs one gesture. No modal interruptions, no
   confetti — trust is the aesthetic.
5. **Keyboard-first web, thumb-first mobile.** Desktop: every action reachable via the command
   palette (`⌘K`) without a mouse. Phone: every daily-loop action reachable one-handed from the
   bottom half of the screen.

## 2. The signature elements (what makes it "ours")

### 2.1 Day Canvas
A vertical timeline of today, the home screen everywhere:

- **Outer track** = attendance frame (punch-in → punch-out, breaks as notches) — REQ-028.
- **Inner blocks** = project entries (solid, project-colored), meetings (pinned, with a
  transcript dot once #32 delivered), gaps (visibly empty, tappable to fill).
- **Ghost blocks** = Co-Planner proposals (REQ-031): dashed outline, one tap to accept, drag to
  adjust, swipe to dismiss.
- Direct manipulation: drag edges to resize, long-press to split, drop onto another block to
  merge; snapping follows the workspace rounding profile.
- The reconciliation question — "is my presence covered by project time?" — is answered by
  *looking*, not by opening a report.

### 2.2 Co-Planner briefing (morning) & review (evening)
- **Morning:** one card: "Dein Tag: 3 Meetings, 4,5h Fokus möglich. Vorschlag?" → ghost blocks
  land on the canvas. Accept all with one tap, or sculpt.
- **During the day:** a quiet drift indicator (current block vs. plan); a moved meeting offers
  one-tap "Rest des Tages neu planen".
- **Evening:** plan-vs-actual strip (kept/moved/dropped), punch-out prompt if still stamped in,
  one tap to generate the standup (#19).

### 2.3 The Island
One persistent, glanceable element carrying live state across all platforms: running timer +
punch status + break state. iOS: Live Activity/Dynamic Island; Android: ongoing notification;
Web/tablet: a floating pill (bottom-center) that expands into quick actions. Same information
architecture everywhere — users learn it once.

### 2.4 Command palette (web) / Quick-Add sheet (mobile)
`⌘K` opens one input that does everything: NL time entry ("2h finanzo review gestern", #18),
navigation ("projekte zeigen"), actions ("urlaub nächsten freitag eintragen"), questions
(handing off to the assistant, #20). Mobile mirrors it as a pull-up Quick-Add sheet with the
same parser. This is where "developer tool" becomes tangible.

### 2.5 Stats that read like instruments
Reports (#13) use a restrained, consistent viz language: budget **rings** per project
(consumption at a glance), an overtime **balance gauge** (positive/negative around zero),
**small-multiple** week sparklines instead of one giant chart, calendar **heatmap** for
intensity. Every figure clickable → drills to the exact entries (auditability as UX).

## 3. Information architecture

| Surface | Content | Primary platform bias |
|---|---|---|
| **Today** | Day Canvas + Island + briefing/review cards | Phone-first, everywhere |
| **Planner** | Week view of canvases; drag blocks across days; absence overlay | Tablet/desktop |
| **Projects** | Clients → projects → tasks, budget rings, rates | All |
| **Reports** | Instruments (2.5), report builder, exports (#14/#38) | Desktop-first |
| **Meetings** | Transcript list, AI insights, custom prompts (#32/#33) | Desktop/tablet |
| **Assistant** | Grounded, read-only chat over your own data (#20) | All |
| **Profile** | Absences calendar (#37), schedules, credits balance (#34), settings, hub to secondary surfaces | All |

Bottom tabs (phone): Today · Planner · Projects · Reports · Profile. Sidebar (tablet/desktop)
with the same five + Meetings + Assistant promoted to top level. The phone keeps exactly five
tabs; the secondary surfaces (Meetings, Assistant) are reached there from the **Profile hub**,
never a sixth tab.

## 4. Visual & motion language

- **Dark-first**, light theme as first-class sibling. Near-black surfaces (not pure #000),
  one restrained accent for interactive elements; **project colors** are the only saturated
  palette on screen — data is the color, chrome stays quiet.
- **Typography:** humanist sans for UI; **tabular/monospace numerals for every duration and
  amount** — numbers are the product, they must align and feel technical.
- **Depth via layers, not shadows-everywhere:** canvas below, cards above, Island on top.
- **Motion is physics, not decoration:** blocks settle with a short spring when dropped; the
  Island morphs (not swaps) between states; punch-in/out gets a haptic tick. All motion honors
  reduced-motion settings. 150–250 ms, nothing longer in the daily loop.
- **8-pt grid**, 44-pt minimum touch targets, WCAG AA contrast in both themes; dynamic type up
  to XL without layout breakage (the canvas scales density, not truncation).

## 5. Honest constraints

- The Day Canvas with direct manipulation is the hardest UI in the app — it is explicitly in
  the #1 spike's scope-of-proof (RN gesture/animation quality) and gets its micro-interaction
  spec in #39 before implementation.
- "Revolutionary" is claimed by the Co-Planner concept and the canvas — **not** by exotic
  navigation. Tabs, sheets, and lists stay boring on purpose; novelty budget is spent in one
  place.
- Every AI surface follows ADR-0005 provenance rules visually: ghost style + source chip. A
  design that makes AI output indistinguishable from user data fails review, however pretty.
