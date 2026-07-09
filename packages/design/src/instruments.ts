/**
 * Instrument geometry (ux-vision §2.5) — the pure math behind the Reports
 * "stats that read like instruments": budget **rings**, the overtime **balance
 * gauge**, and week **sparklines**. Platform-agnostic and deterministic (ADR-0005)
 * so the exact same numbers drive the SVG on device, in a snapshot, and in a test;
 * the RN components in `apps/mobile` are thin `react-native-svg` shells over these.
 */

/**
 * Stroke-dashoffset for a ring drawn as an SVG circle whose `strokeDasharray` is
 * the full circumference: the offset that leaves `ratio` of the ring painted.
 * `ratio` is clamped to `[0, 1]` (an over-budget ring fills completely; the tone,
 * not the geometry, carries "over"). `ratio = 0 → full circumference` (empty),
 * `ratio = 1 → 0` (full).
 */
export function ringDashOffset(ratio: number, circumference: number): number {
  const filled = Math.max(0, Math.min(1, ratio))
  return circumference * (1 - filled)
}

/**
 * Angle (degrees, measured clockwise from straight up) of a balance-gauge needle
 * for `value` on a symmetric scale `[-range, +range]`: `0 → 0°` (up), `+range →
 * +90°` (right), `-range → −90°` (left). Clamped to `±90°`; `range ≤ 0 → 0°`.
 */
export function gaugeAngle(value: number, range: number): number {
  if (range <= 0) return 0
  const clamped = Math.max(-range, Math.min(range, value))
  return (clamped / range) * 90
}

/**
 * A point on a circle for an angle measured **clockwise from 12 o'clock**, in the
 * SVG coordinate space (y grows downward). Used for gauge needles and tick marks.
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

/**
 * An SVG `points` string mapping a numeric series onto a `width × height` box:
 * evenly spaced in x, and in y with the series min at the bottom and max at the
 * top. A flat series (or a single value) sits on the mid-line. Empty series → "".
 */
export function sparklinePoints(values: readonly number[], width: number, height: number): string {
  if (values.length === 0) return ''
  const mid = height / 2
  if (values.length === 1) return `0,${String(mid)}`
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const stepX = width / (values.length - 1)
  return values
    .map((v, i) => {
      const x = i * stepX
      const y = span === 0 ? mid : (1 - (v - min) / span) * height
      return `${String(x)},${String(y)}`
    })
    .join(' ')
}
