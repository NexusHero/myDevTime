/**
 * Block states of the calm canvas (ADR-0072 D3, REQ-074, issue #341): every plan
 * block is in exactly one of four unmistakable states — `planned / live / done /
 * missed` — derived deterministically from the clock and the observed reality
 * coverage (ADR-0005; the LLM is nowhere near this). `missed` is the drift-derived
 * state the one-tap repair (#339) consumes.
 *
 * Project colour is worn as the block's **bold fill** (owner decision, 2026-07 —
 * "Farbe knallt, Ruhe kommt aus Layern"): the punch stays in the colour, calm
 * comes from the layer chips + edge-hour compression, not from draining the fill.
 * The four states read *on top of* the fill — never by removing it: planned is the
 * full bold fill, live adds a live marker, done recedes (fill muted toward the
 * surface, still clearly coloured), missed keeps the fill and gains a dashed tear
 * edge (the handle #339's repair needs). Text ink is chosen deterministically by
 * luminance so it clears WCAG AA on every project fill (blockState.test.ts).
 */

import { contrastRatio, parseHex } from '../contrast.js'
import type { Palette } from '../palette.js'
import type { Interval } from '../planner.js'

export type PlannerBlockState = 'planned' | 'live' | 'done' | 'missed'

/**
 * Below this observed-coverage fraction a past block reads `missed` (drift
 * detected): less than a quarter of the block saw any tracked activity.
 */
export const MISSED_COVERAGE_MIN = 0.25

/** The two ink candidates for text on a bold fill — a near-white and a near-black. */
export const INK_ON_DARK = '#ffffff'
export const INK_ON_LIGHT = '#0b0e14'

/** How far a `done` block's fill is mixed toward the surface — muted, still coloured. */
export const DONE_MUTE = 0.35

/** The AA-normal target the block fill's readable ink is guaranteed to clear. */
export const FILL_INK_TARGET = 4.5

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}
function toHex(n: number): string {
  return clamp255(n).toString(16).padStart(2, '0')
}

/** Linear mix of two hex colours, `t` in `[0, 1]` toward `b`. Returns `#rrggbb`. */
export function mixHex(a: string, b: string, t: number): string {
  const A = parseHex(a)
  const B = parseHex(b)
  const k = Math.min(Math.max(t, 0), 1)
  return `#${toHex(A.r + (B.r - A.r) * k)}${toHex(A.g + (B.g - A.g) * k)}${toHex(A.b + (B.b - A.b) * k)}`
}

/**
 * The readable ink for text on `bg`: whichever of the near-white / near-black
 * candidate gives the higher contrast. Deterministic (ADR-0005) — the same fill
 * always picks the same ink, so a bold project fill is always legible.
 */
export function readableInk(bg: string): string {
  return contrastRatio(INK_ON_DARK, bg) >= contrastRatio(INK_ON_LIGHT, bg)
    ? INK_ON_DARK
    : INK_ON_LIGHT
}

/**
 * A `fill` deepened just enough that its readable ink clears the AA-normal
 * `target`, so a bold project fill is always legible for its title text. Most
 * project colours already clear it and pass through unchanged; only a few
 * mid-tones deepen by a step or two (toward black/white, whichever raises
 * contrast) — still clearly the same hue, still bold. Deterministic (ADR-0005).
 */
export function legibleFill(fill: string, target: number = FILL_INK_TARGET): string {
  let c = fill
  for (let i = 0; i < 16; i++) {
    const ink = readableInk(c)
    if (contrastRatio(ink, c) >= target) return c
    // Ink is white → deepen toward black; ink is near-black → lift toward white.
    c = mixHex(c, ink === INK_ON_DARK ? '#000000' : '#ffffff', 0.06)
  }
  return c
}

/**
 * The fraction of `[startMin, startMin + lenMin)` covered by the observed
 * intervals, `0`–`1`. Overlapping observations never double-count (merged
 * sweep), so coverage is honest. A zero-length block reads fully covered —
 * there was nothing to miss. Throws on a negative length.
 */
export function intervalCoverage(
  startMin: number,
  lenMin: number,
  observed: readonly Interval[],
): number {
  if (lenMin < 0) throw new Error('lenMin must not be negative')
  if (lenMin === 0) return 1
  const end = startMin + lenMin
  const clipped = observed
    .map(o => ({
      start: Math.max(o.startMin, startMin),
      end: Math.min(o.startMin + Math.max(o.lenMin, 0), end),
    }))
    .filter(o => o.end > o.start)
    .sort((a, b) => a.start - b.start)
  let covered = 0
  let cursor = startMin
  for (const o of clipped) {
    const from = Math.max(o.start, cursor)
    if (o.end > from) {
      covered += o.end - from
      cursor = o.end
    }
  }
  return covered / lenMin
}

/**
 * Derive a block's state from the clock and the observed coverage:
 * - before its start → `planned`;
 * - while the clock is inside it → `live`;
 * - after its end → `done`, unless drift was observed: with a reality source
 *   (`coveredFraction` a number) a coverage below {@link MISSED_COVERAGE_MIN}
 *   reads `missed`. Without a reality source (`null`) a past block reads `done` —
 *   the canvas never *claims* a miss it cannot observe (honesty rule, ADR-0005).
 */
export function plannerBlockState(
  startMin: number,
  lenMin: number,
  nowMin: number,
  coveredFraction: number | null = null,
): PlannerBlockState {
  if (lenMin < 0) throw new Error('lenMin must not be negative')
  if (nowMin < startMin) return 'planned'
  if (nowMin < startMin + lenMin) return 'live'
  if (coveredFraction !== null && coveredFraction < MISSED_COVERAGE_MIN) return 'missed'
  return 'done'
}

/**
 * How a block wears its state (issue #341, owner-revised): the project colour is
 * always the fill, and the state is an *addition* on top — never removed colour.
 */
export interface BlockStateStyle {
  /** The block's bold fill — the project colour, muted toward the surface for `done`. */
  readonly fill: string
  /** Title ink (top of the type hierarchy), luminance-picked to clear AA on the fill. */
  readonly title: string
  /** Time-range ink (second tier) — same readable ink as the title. */
  readonly time: string
  /** State marker colour (live dot / done check / missed `!`); `null` = no marker. */
  readonly marker: string | null
  /** `missed` blocks wear a dashed tear edge — the repair handle (#339) is visible. */
  readonly dashed: boolean
  /** The edge colour: the readable ink for a missed tear, else `null` (no visible edge). */
  readonly edge: string | null
}

/**
 * The styling for a block of `state` filled with `fill` (its project/kind colour),
 * resolved against the theme `palette`. The fill stays bold and colourful for
 * every state; `done` recedes by mixing toward the surface (still clearly
 * coloured); the ink is always the luminance-readable choice so AA holds.
 */
export function blockStateStyle(
  state: PlannerBlockState,
  fill: string,
  p: Palette,
): BlockStateStyle {
  const raw = state === 'done' ? mixHex(fill, p.surface, DONE_MUTE) : fill
  const solidFill = legibleFill(raw)
  const ink = readableInk(solidFill)
  const base: BlockStateStyle = {
    fill: solidFill,
    title: ink,
    time: ink,
    marker: null,
    dashed: false,
    edge: null,
  }
  switch (state) {
    case 'planned':
      return base
    case 'live':
      // The one thing happening now: keep the bold fill, add the live orange marker.
      return { ...base, marker: p.live }
    case 'done':
      // Receded but clearly coloured; a subtle check in the readable ink.
      return { ...base, marker: ink }
    case 'missed':
      // Drift: the fill stays, a dashed tear edge (in the readable ink) is the
      // handle the one-tap repair consumes, plus a `!` marker.
      return { ...base, marker: ink, dashed: true, edge: ink }
  }
}
