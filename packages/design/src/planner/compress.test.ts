import { describe, expect, it } from 'vitest'
import {
  COMPRESSED_BAND_WEIGHT_MIN,
  EVENING_EDGE_MIN,
  MORNING_EDGE_MIN,
  compressWindow,
  compressedMinAt,
  compressedRect,
  compressedTotalWeight,
  compressedY,
} from './compress.js'

/**
 * Zeit-Kompression boundary contract (issue #341): the collapsed edge bands are
 * pure, deterministic layout math both canvases consume — the boundary cases the
 * issue names are explicit tests, not folklore.
 */

const DAY = { start: 0, end: 24 * 60 }

describe('compressWindow', () => {
  it('EmptyDay_CompressesToTheWorkingBand', () => {
    const bands = compressWindow([], DAY.start, DAY.end)
    expect(bands).toEqual([
      { startMin: 0, endMin: MORNING_EDGE_MIN, compressed: true },
      { startMin: MORNING_EDGE_MIN, endMin: EVENING_EDGE_MIN, compressed: false },
      { startMin: EVENING_EDGE_MIN, endMin: 24 * 60, compressed: true },
    ])
  })

  it('BlockAt0630_KeepsItsWholeHourVisible', () => {
    // The issue's named boundary: a block at 06:30 expands the morning to 06:00.
    const bands = compressWindow([{ startMin: 390, lenMin: 60 }], DAY.start, DAY.end)
    expect(bands[0]).toEqual({ startMin: 0, endMin: 360, compressed: true })
    expect(bands[1]).toEqual({ startMin: 360, endMin: EVENING_EDGE_MIN, compressed: false })
  })

  it('EveningBlock_ExpandsTheEveningToItsCeilingHour', () => {
    // 21:10–22:10 → the evening edge moves to 23:00; 23:00–24:00 stays compressed.
    const bands = compressWindow([{ startMin: 1270, lenMin: 60 }], DAY.start, DAY.end)
    expect(bands[1]).toEqual({ startMin: MORNING_EDGE_MIN, endMin: 1380, compressed: false })
    expect(bands[2]).toEqual({ startMin: 1380, endMin: 1440, compressed: true })
  })

  it('BlockCoveringTheWholeDay_LeavesNoCompressedBand', () => {
    const bands = compressWindow([{ startMin: 0, lenMin: 1440 }], DAY.start, DAY.end)
    expect(bands).toEqual([{ startMin: 0, endMin: 1440, compressed: false }])
  })

  it('BlocksInsideTheWorkingBand_KeepTheDefaultEdges', () => {
    const bands = compressWindow([{ startMin: 540, lenMin: 120 }], DAY.start, DAY.end)
    expect(bands).toHaveLength(3)
    expect(bands[1]).toEqual({
      startMin: MORNING_EDGE_MIN,
      endMin: EVENING_EDGE_MIN,
      compressed: false,
    })
  })

  it('BlocksOutsideTheWindow_AndZeroLength_AreIgnored', () => {
    const bands = compressWindow(
      [
        { startMin: -120, lenMin: 60 }, // ends before the window
        { startMin: 25 * 60, lenMin: 30 }, // starts after it
        { startMin: 300, lenMin: 0 }, // zero-length
      ],
      DAY.start,
      DAY.end,
    )
    expect(bands[1]).toEqual({
      startMin: MORNING_EDGE_MIN,
      endMin: EVENING_EDGE_MIN,
      compressed: false,
    })
  })

  it('NarrowWindow_ClampsTheEdgesInsideIt', () => {
    // A window already inside the working band has nothing to compress.
    const bands = compressWindow([], 480, 1080)
    expect(bands).toEqual([{ startMin: 480, endMin: 1080, compressed: false }])
  })

  it('CustomEdges_AreHonoured', () => {
    const bands = compressWindow([], DAY.start, DAY.end, {
      morningEdgeMin: 480,
      eveningEdgeMin: 1080,
    })
    expect(bands[1]).toEqual({ startMin: 480, endMin: 1080, compressed: false })
  })

  it('InvertedWindow_AndNegativeLength_Throw', () => {
    expect(() => compressWindow([], 600, 600)).toThrow()
    expect(() => compressWindow([{ startMin: 300, lenMin: -1 }], DAY.start, DAY.end)).toThrow()
  })
})

describe('compressedY / compressedRect', () => {
  const bands = compressWindow([], DAY.start, DAY.end)
  const total = compressedTotalWeight(bands)

  it('TotalWeight_IsWorkingBandPlusTwoThinStrips', () => {
    expect(total).toBe(EVENING_EDGE_MIN - MORNING_EDGE_MIN + 2 * COMPRESSED_BAND_WEIGHT_MIN)
  })

  it('ShortCompressedBand_KeepsItsRealLength_NeverInflates', () => {
    // A 10-minute morning edge weighs 10 minutes, not the 24-minute strip.
    const b = compressWindow([], 410, 1440, { morningEdgeMin: 420 })
    expect(compressedTotalWeight(b)).toBe(
      10 + (EVENING_EDGE_MIN - 420) + COMPRESSED_BAND_WEIGHT_MIN,
    )
  })

  it('MapsTheWindowEdgesTo0And1_AndClampsOutside', () => {
    expect(compressedY(bands, 0)).toBe(0)
    expect(compressedY(bands, 1440)).toBe(1)
    expect(compressedY(bands, -50)).toBe(0)
    expect(compressedY(bands, 2000)).toBe(1)
  })

  it('IsMonotonicAcrossBandBoundaries', () => {
    let last = -1
    for (let min = 0; min <= 1440; min += 15) {
      const y = compressedY(bands, min)
      expect(y).toBeGreaterThanOrEqual(last)
      last = y
    }
  })

  it('AMinuteInTheExpandedBand_IsAFullMinuteTall', () => {
    const oneMin = compressedY(bands, 601) - compressedY(bands, 600)
    expect(oneMin).toBeCloseTo(1 / total, 10)
  })

  it('ACompressedHour_IsThinnerThanAnExpandedHour', () => {
    const compressedHour = compressedY(bands, 60) - compressedY(bands, 0)
    const expandedHour = compressedY(bands, 600) - compressedY(bands, 540)
    expect(compressedHour).toBeLessThan(expandedHour)
  })

  it('Rect_SpansCompressedAndExpandedBandsContinuously', () => {
    // 06:40–07:20 crosses the morning boundary; top/height stay finite and ordered.
    const r = compressedRect(bands, 400, 40)
    expect(r.top).toBeGreaterThan(0)
    expect(r.height).toBeGreaterThan(0)
    expect(r.top + r.height).toBeCloseTo(compressedY(bands, 440), 10)
  })

  it('ZeroLengthRect_HasZeroHeight_AndNegativeThrows', () => {
    expect(compressedRect(bands, 600, 0).height).toBe(0)
    expect(() => compressedRect(bands, 600, -5)).toThrow()
  })

  it('EmptyBands_Throw', () => {
    expect(() => compressedY([], 100)).toThrow()
    expect(() => compressedMinAt([], 0.5)).toThrow()
  })
})

describe('compressedMinAt (inverse mapping)', () => {
  const bands = compressWindow([{ startMin: 390, lenMin: 60 }], DAY.start, DAY.end)

  it('RoundTripsThroughCompressedY', () => {
    for (const min of [0, 100, 360, 390, 600, 1199, 1440]) {
      expect(compressedMinAt(bands, compressedY(bands, min))).toBeCloseTo(min, 6)
    }
  })

  it('ClampsFractionsOutside01ToTheWindowEdges', () => {
    expect(compressedMinAt(bands, -0.5)).toBe(0)
    expect(compressedMinAt(bands, 1.5)).toBe(1440)
  })
})
