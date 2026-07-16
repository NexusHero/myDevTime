# ADR 0062: Accessibility baseline — labelled primitives + graphical-instrument descriptions

## Status

Accepted (owner decision) — realizes the first slice of **REQ-043** (#263); extends
the design system (ADR-0022/0030) and the contrast contract already enforced by
`packages/design/contrast.ts`.

## Context

The web build is a primary target, but `react-native-web` renders our primitives as
generic wrappers, so accessibility depends on the `accessibility*` props we set.
Colour contrast is already enforced (WCAG AA in CI). The remaining gaps are
structure, keyboard operability, and screen-reader support (REQ-043).

An audit of the client found the interactive primitives already carry roles + labels
(Button/IconButton/Tabs/Row/Island — `accessibilityRole` + `accessibilityLabel`,
which react-native-web maps to ARIA `role` + `aria-label`). The real hole is the
**graphical instruments**: the SVG / coloured-bar widgets (Gauge, Heatmap, BoxPlot,
sparklines) carry no text, so a screen reader announces *nothing* — the number, which
is the product, is inaudible.

## Decision

Adopt a two-part a11y approach; this ADR lands part 1.

1. **Graphical instruments announce their value.** Every SVG / bar-only instrument
   exposes `accessibilityRole="image"` + a value-bearing `accessibilityLabel`
   (→ `role="img"` + `aria-label` on web, which collapses the widget to one spoken
   node): the Gauge speaks its signed value + range, the Heatmap its span + peak, the
   BoxPlot its five-number summary, the week sparkline its named trend. Instruments
   that already render their number as `Text` (StatTile, LeaveBalance, LoadMeter,
   OvertimeGauge's readout) stay text-readable and are not double-labelled. Render
   tests (ADR-0027 tier) pin each label.
2. **Interactive primitives** keep their existing role/label/state; the standing
   review lens now treats a missing label on an icon-only control as a defect.

Deferred to the next slice (noted here so the approach is on record): an **axe-core
Playwright check** in the E2E tier (ADR-0053) asserting no critical/serious
violations on the core screens, and a **keyboard golden-path** test (sign-in →
Today → start timer) with a visible focus ring. These need the running stack and a
new E2E dependency, so they ship separately.

## Consequences

- **Pros**: screen-reader users hear the instruments' numbers instead of silence; the
  labels are deterministic strings, unit-testable under the render tier; no new
  dependency and no design change (labels are invisible chrome).
- **Cons / limits**: this is a baseline, not full WCAG 2.1 AA conformance — the
  automated axe gate and keyboard/focus-management pass are still outstanding (REQ-043
  stays **Partial**). `role="img"` grouping relies on AT honouring the label over the
  children; the axe gate will catch any that don't.
