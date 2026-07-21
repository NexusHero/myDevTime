import { describe, expect, it } from 'vitest'
import { AA_LARGE, AA_NORMAL, meetsAA } from '../contrast.js'
import { ACCENT_THEMES, palettes, projectColors, type Palette } from '../palette.js'
import {
  INK_ON_DARK,
  INK_ON_LIGHT,
  MISSED_COVERAGE_MIN,
  blockStateStyle,
  intervalCoverage,
  mixHex,
  plannerBlockState,
  readableInk,
  type PlannerBlockState,
} from './blockState.js'

describe('intervalCoverage', () => {
  it('NoObservations_IsZero_FullOverlap_IsOne', () => {
    expect(intervalCoverage(540, 60, [])).toBe(0)
    expect(intervalCoverage(540, 60, [{ startMin: 500, lenMin: 200 }])).toBe(1)
  })

  it('PartialAndOverlappingObservations_NeverDoubleCount', () => {
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

describe('colour helpers', () => {
  it('MixHex_InterpolatesAndClampsT', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#ff0000', '#0000ff', 2)).toBe('#0000ff') // t clamped to 1
  })

  it('ReadableInk_PicksTheHigherContrastCandidate', () => {
    // A bright fill takes the near-black ink; a dark fill takes the near-white.
    expect(readableInk('#f5d90a')).toBe(INK_ON_LIGHT)
    expect(readableInk('#123456')).toBe(INK_ON_DARK)
  })
})

/**
 * The four states' AA contract (issue #341, owner-revised to bold fills). The fill
 * is the actual project colour (muted toward the surface for `done`), and the
 * luminance-picked ink carries every glyph that *reads as text* — the title
 * (normal, 4.5:1) and the time (large, 3:1) — plus the missed tear edge, on that
 * fill, for **every** project colour, in light AND dark, across all four states.
 * The `live` marker is the orange status pip (the now/live signal), decorative
 * like the now-line — exempt from the text contract, exactly as `live` is in the
 * palette a11y contract (contrast.test.ts). A palette change that breaks the ink's
 * legibility on any real fill fails the build.
 */
const STATES: readonly PlannerBlockState[] = ['planned', 'live', 'done', 'missed']

describe.each(ACCENT_THEMES)('block-state legibility · %s accent', accent => {
  for (const mode of ['dark', 'light'] as const) {
    const p: Palette = palettes[accent][mode]
    describe.each(projectColors[mode])(`${mode} fill %s`, fill => {
      it.each(STATES)('%s · title AA-normal, time AA-large, tear edge visible', state => {
        const s = blockStateStyle(state, fill, p)
        expect(meetsAA(s.title, s.fill, AA_NORMAL)).toBe(true)
        expect(meetsAA(s.time, s.fill, AA_LARGE)).toBe(true)
        // The done/missed markers are the readable ink; the live pip is exempt.
        if (s.marker !== null && state !== 'live') {
          expect(meetsAA(s.marker, s.fill, AA_LARGE)).toBe(true)
        }
        if (s.edge !== null) expect(meetsAA(s.edge, s.fill, AA_LARGE)).toBe(true)
      })
    })
  }
})

describe('block-state form', () => {
  const p = palettes.sovereign.light
  // A project colour that already clears AA — it passes through legibleFill unchanged,
  // so the "colour is the fill" contract is exact for it.
  const fill = '#00937c'

  it('EveryState_KeepsAColouredFill_ProjectColourIsNeverDrained', () => {
    // planned/live/missed keep the exact project fill; done stays clearly coloured.
    expect(blockStateStyle('planned', fill, p).fill).toBe(fill)
    expect(blockStateStyle('live', fill, p).fill).toBe(fill)
    expect(blockStateStyle('missed', fill, p).fill).toBe(fill)
    const done = blockStateStyle('done', fill, p).fill
    expect(done).not.toBe(fill) // muted vs. the full-strength planned fill
    expect(done).not.toBe(p.surface) // …but still clearly coloured, not drained
  })

  it('OnlyMissed_WearsTheDashedTearEdge_TheRepairHandle', () => {
    expect(STATES.filter(st => blockStateStyle(st, fill, p).dashed)).toEqual(['missed'])
    expect(blockStateStyle('missed', fill, p).edge).not.toBeNull()
  })

  it('LiveWearsTheLiveMarker_DoneAndMissedCarryTheirOwn_PlannedHasNone', () => {
    expect(blockStateStyle('planned', fill, p).marker).toBeNull()
    expect(blockStateStyle('live', fill, p).marker).toBe(p.live)
    expect(blockStateStyle('done', fill, p).marker).not.toBeNull()
    expect(blockStateStyle('missed', fill, p).marker).not.toBeNull()
  })
})
