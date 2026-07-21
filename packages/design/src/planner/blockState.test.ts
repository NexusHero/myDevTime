import { describe, expect, it } from 'vitest'
import { AA_LARGE, AA_NORMAL, meetsAA } from '../contrast.js'
import { ACCENT_THEMES, palettes, type Palette } from '../palette.js'
import {
  MISSED_COVERAGE_MIN,
  blockStateStyle,
  intervalCoverage,
  plannerBlockState,
  type PlannerBlockState,
} from './blockState.js'

describe('intervalCoverage', () => {
  it('NoObservations_IsZero_FullOverlap_IsOne', () => {
    expect(intervalCoverage(540, 60, [])).toBe(0)
    expect(intervalCoverage(540, 60, [{ startMin: 500, lenMin: 200 }])).toBe(1)
  })

  it('PartialAndOverlappingObservations_NeverDoubleCount', () => {
    // Two observations covering the same first half → exactly 0.5, not 1.
    const observed = [
      { startMin: 540, lenMin: 30 },
      { startMin: 550, lenMin: 20 },
    ]
    expect(intervalCoverage(540, 60, observed)).toBeCloseTo(0.5, 10)
  })

  it('ObservationsOutsideTheBlock_AndZeroLength_CountNothing', () => {
    expect(
      intervalCoverage(540, 60, [
        { startMin: 0, lenMin: 60 },
        { startMin: 700, lenMin: 60 },
        { startMin: 550, lenMin: 0 },
      ]),
    ).toBe(0)
  })

  it('ZeroLengthBlock_ReadsFullyCovered_NegativeThrows', () => {
    expect(intervalCoverage(540, 0, [])).toBe(1)
    expect(() => intervalCoverage(540, -1, [])).toThrow()
  })
})

describe('plannerBlockState', () => {
  it('ClockBeforeStart_IsPlanned', () => {
    expect(plannerBlockState(540, 60, 500)).toBe('planned')
  })

  it('ClockInside_IsLive_InclusiveStartExclusiveEnd', () => {
    expect(plannerBlockState(540, 60, 540)).toBe('live')
    expect(plannerBlockState(540, 60, 599)).toBe('live')
    expect(plannerBlockState(540, 60, 600)).not.toBe('live')
  })

  it('PastWithoutARealitySource_IsDone_NeverClaimsAMiss', () => {
    expect(plannerBlockState(540, 60, 700, null)).toBe('done')
  })

  it('PastWithCoverage_SplitsDoneFromMissedAtTheThreshold', () => {
    expect(plannerBlockState(540, 60, 700, MISSED_COVERAGE_MIN)).toBe('done')
    expect(plannerBlockState(540, 60, 700, MISSED_COVERAGE_MIN - 0.01)).toBe('missed')
    expect(plannerBlockState(540, 60, 700, 0)).toBe('missed')
    expect(plannerBlockState(540, 60, 700, 1)).toBe('done')
  })

  it('NegativeLength_Throws', () => {
    expect(() => plannerBlockState(540, -1, 600)).toThrow()
  })
})

/**
 * The four states' AA contract (issue #341): every ink the block styles place on
 * the block's own fill clears WCAG AA — titles as normal text, times and markers
 * as large/bold text — in light **and** dark across **all three accents**. A
 * palette tweak that breaks any of the 24 state × accent × mode combinations
 * fails the build (extends the palette a11y contract in contrast.test.ts).
 */
const STATES: readonly PlannerBlockState[] = ['planned', 'live', 'done', 'missed']
const combos: readonly [string, Palette][] = ACCENT_THEMES.flatMap(accent => [
  [`${accent}/dark`, palettes[accent].dark] as [string, Palette],
  [`${accent}/light`, palettes[accent].light] as [string, Palette],
])

describe.each(combos)('block-state styles · %s', (_name, p: Palette) => {
  it.each(STATES)(
    '%s · title clears AA normal, time and marker clear AA large on the fill',
    state => {
      const s = blockStateStyle(state, p)
      expect(meetsAA(s.title, s.fill, AA_NORMAL)).toBe(true)
      expect(meetsAA(s.time, s.fill, AA_LARGE)).toBe(true)
      if (s.marker !== null) expect(meetsAA(s.marker, s.fill, AA_LARGE)).toBe(true)
    },
  )

  it('ProjectColourIsNeverTheFill_FillsAreNeutralSurfaces', () => {
    for (const state of STATES) {
      const s = blockStateStyle(state, p)
      expect([p.surface, p.sunk, p.raised]).toContain(s.fill)
    }
  })

  it('OnlyMissed_WearsTheDashedEdge_OnlyDone_Recedes', () => {
    expect(STATES.filter(st => blockStateStyle(st, p).dashed)).toEqual(['missed'])
    expect(STATES.filter(st => blockStateStyle(st, p).dimmed)).toEqual(['done'])
  })
})
