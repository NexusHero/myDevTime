/**
 * Motion easing — the pure math behind the client's mount animations (design v4
 * motion pass). Durations and CSS easing curves live in `tokens.ts` (`motion`,
 * `easing`); this module adds the numeric easing *functions* a client needs to
 * drive a `requestAnimationFrame` interpolation (a count-up, a ring draw-in, a
 * staggered reveal) on platforms with no CSS — i.e. React Native.
 *
 * Kept here (not in the client) so the curve is deterministic and unit-tested
 * once (ADR-0005): every animated instrument reads the same eased progress, and
 * the client only wires it to rAF + reduced-motion.
 */

/** Clamp a progress value to the unit interval [0, 1]. */
export function clamp01(p: number): number {
  if (Number.isNaN(p)) return 0
  return p < 0 ? 0 : p > 1 ? 1 : p
}

/**
 * Ease-out cubic — fast start, gentle settle (`1 - (1 - p)³`), the curve the
 * design system's mount animations use for count-ups and draw-ins. Input is
 * clamped to [0, 1] so callers can pass a raw `elapsed / duration` ratio.
 */
export function easeOutCubic(p: number): number {
  const x = clamp01(p)
  return 1 - Math.pow(1 - x, 3)
}

/**
 * Eased interpolation from 0 to `target` at linear progress `p` — the value a
 * count-up (percent, hours) or a draw-in (ring, gauge) shows at that frame.
 * `target` may be negative (e.g. an overtime deficit); the ease still applies.
 */
export function easeTo(target: number, p: number): number {
  return target * easeOutCubic(p)
}
