/**
 * Block states of the calm canvas (ADR-0072 D3, REQ-074, issue #341): every plan
 * block is in exactly one of four unmistakable states — `planned / live / done /
 * missed` — derived deterministically from the clock and the observed reality
 * coverage (ADR-0005; the LLM is nowhere near this). `missed` is the drift-derived
 * state the one-tap repair (#339) consumes; this module only *derives and styles*
 * it, it never mutates a plan. The styling helper maps a state to palette roles so
 * the RN canvas and the web FullCalendar renderers (ADR-0068) wear the identical
 * language: project colour stays an **edge**, never a fill.
 */

import type { Palette } from '../palette.js'
import type { Interval } from '../planner.js'

export type PlannerBlockState = 'planned' | 'live' | 'done' | 'missed'

/**
 * Below this observed-coverage fraction a past block reads `missed` (drift
 * detected): less than a quarter of the block saw any tracked activity.
 */
export const MISSED_COVERAGE_MIN = 0.25

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
 * The palette roles a block wears per state. The project colour is applied by the
 * caller as the block's **edge** — this style never returns a project fill
 * (issue #341: colour as edge, never a fill; states are told apart by neutral
 * fill, ink weight and the state marker, all AA-checked in blockState.test.ts).
 */
export interface BlockStateStyle {
  /** Neutral block fill — a surface tone, never a project colour. */
  readonly fill: string
  /** Title ink (top of the type hierarchy). */
  readonly title: string
  /** Time-range ink (second tier). */
  readonly time: string
  /** State marker colour (live dot / done check / missed flag); `null` = no marker. */
  readonly marker: string | null
  /** Missed blocks wear a dashed edge — the tear is visible, not just tinted. */
  readonly dashed: boolean
  /** Done blocks recede (the day is lived); everything else is full presence. */
  readonly dimmed: boolean
}

export function blockStateStyle(state: PlannerBlockState, p: Palette): BlockStateStyle {
  switch (state) {
    case 'planned':
      return {
        fill: p.surface,
        title: p.ink,
        time: p.ink2,
        marker: null,
        dashed: false,
        dimmed: false,
      }
    case 'live':
      return {
        fill: p.surface,
        title: p.ink,
        time: p.liveStrong,
        marker: p.live,
        dashed: false,
        dimmed: false,
      }
    case 'done':
      return {
        fill: p.sunk,
        title: p.ink2,
        time: p.ink2,
        marker: p.good,
        dashed: false,
        dimmed: true,
      }
    case 'missed':
      return {
        fill: p.surface,
        title: p.ink2,
        time: p.crit,
        marker: p.crit,
        dashed: true,
        dimmed: false,
      }
  }
}
