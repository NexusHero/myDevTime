# Spike #190 findings — Web accessibility / semantic-HTML gap of react-native-web

**Issue:** [#190](https://github.com/NexusHero/myDevTime/issues/190) · **Relates to:**
[REQ-043](../architecture.md) · [ADR-0062](../adr/0062-accessibility-baseline-approach.md) ·
**Milestone:** Quality / Foundation

## Verdict — **keep react-native-web; close the gap incrementally with ARIA + roles, no semantic-HTML rewrite**

The question this spike settles is whether the DOM `@mydevtime/mobile` emits on the web target
(react-native-web, RNW) is accessible enough to reach WCAG 2.1 AA, or whether the semantic-HTML
gap is severe enough to force a different web strategy (a parallel web build, a semantic wrapper
layer, or abandoning RNW for the web). **It is not.** The gap is real but bounded, and every part
of it is closable **inside RNW** through the accessibility props the framework already maps to ARIA
— no framework change, no forked web codebase. This keeps the ADR-0004 "one codebase for
iOS/Android/Web" bet intact.

## What RNW actually renders (the gap)

RNW renders **every** `View` as a `<div>` and every `Text` as a `<div>`/`<span>` — there are no
intrinsic `<nav>`, `<main>`, `<header>`, `<h1>`–`<h6>`, `<button>`, `<input>`, or `<ul>/<li>` in the
output. Semantics come **only** from the `accessibility*` props, which RNW maps to ARIA:

- `accessibilityRole="button"` → `role="button"` (+ keyboard/focus behaviour on `Pressable`)
- `accessibilityLabel` → `aria-label`
- `accessibilityState={{ checked, selected, disabled }}` → `aria-checked` / `aria-selected` / `aria-disabled`
- `accessibilityRole="header"` → `role="heading"` (RNW also emits `aria-level`, default 2)

So the gap has three concrete faces:

1. **No landmarks.** The app shell (nav rail / bottom tabs / main content / header) renders as
   nested `<div>`s with no `role="navigation"` / `role="main"` / `role="banner"`, so a screen-reader
   user cannot jump between regions.
2. **No heading hierarchy.** A codebase scan finds **zero** heading semantics today —
   `grep accessibilityRole=\"header\"` and `role=\"heading\"` both return nothing across
   `apps/mobile/src`. Screen titles and section titles are plain styled `Text`, so there is no
   document outline to navigate by heading.
3. **Form controls are div-based.** Inputs/switches/segmented controls carry ARIA roles/labels but
   are not native `<input>`/`<select>`, so some AT heuristics and browser autofill do not apply.

## What is already mitigated (so the gap is narrow, not wide)

The a11y baseline (ADR-0062, REQ-043) already covers the highest-severity items, and the codebase
scan confirms it in the source, not just on paper:

- **Interactive primitives are labelled.** 52 source files use `accessibilityRole`; the roles in
  use are `button` (61×), `image`, `alert`, `timer`, `summary`, `link`, `checkbox`, `radio`,
  `progressbar`, `text` — i.e. every tappable control and every graphical instrument announces its
  role and value (`role="img"` + `aria-label` on Gauge/Heatmap/BoxPlot/sparklines).
- **An axe-core gate runs against the real app.** `e2e/tests/a11y.spec.ts` fails CI on any
  critical/serious WCAG **A/AA** violation on the sign-in screen and on Today after sign-in — so a
  regression that drops a label or breaks contrast is caught, not just linted.
- **Contrast is enforced** in `packages/design` (WCAG AA math in CI).

That baseline means the remaining gap is **structure** (landmarks + headings + focus), not the
label-level basics — which is exactly the deferred slice ADR-0062 named.

## Recommendation — the closable checklist (tracked under REQ-043 / [#263](https://github.com/NexusHero/myDevTime/issues/263))

All of the following are RNW-native and need no new dependency or web fork:

1. **Landmarks on the shell.** Add `accessibilityRole="navigation"` / `"main"` / `"header"` (RNW
   maps these to the matching ARIA landmark roles) to the app-shell nav rail / bottom tab bar /
   content region / top bar. One small change in the shell, app-wide benefit.
2. **Heading hierarchy.** Give each screen title `accessibilityRole="header"` with
   `aria-level={1}` and section titles `aria-level={2}` (RNW forwards `aria-level`). This is the
   single highest-value fix — it creates the document outline that is entirely absent today.
3. **Visible focus-ring + focus management on nav/modals.** The keyboard-operable golden path and a
   visible focus ring on interactive elements, plus moving focus into an opened drawer/dialog and
   restoring it on close (the overlay components already render `accessibilityViewIsModal`). This is
   the concrete remainder of REQ-043 and is where [#263](https://github.com/NexusHero/myDevTime/issues/263)
   continues.
4. **Extend the axe gate to headings/landmarks** once (1)–(2) land, so the structure can't regress.

Native `<input>` semantics for form controls are a **non-goal** for AA: RNW's ARIA-annotated
controls satisfy WCAG AA, and swapping to native inputs would fork the primitive per platform —
against ADR-0004. It is noted as a possible best-practice follow-up, not a gate.

**Net:** no architecture change. The web-a11y gap is a bounded, RNW-native structure task that folds
into REQ-043's remaining slice (#263) — landmarks + headings + focus — with the axe-core gate
guarding it. This spike is the decision record for that path; the implementation is #263.
