import { describe, expect, it } from 'vitest'
import { HOUR_MS } from '../tracking/time.js'
import { estimateFromHistory } from './quote.js'

/**
 * Acceptance for quote-from-history (REQ-053, design v13 KI2). The estimate is grounded
 * in real past durations; the buffered suggestion sits at an upper percentile so a quote
 * has headroom. No history → null (honest refusal, no invented number).
 */
const h = (n: number): number => n * HOUR_MS

describe('estimateFromHistory', () => {
  it('ReportsTheDistributionOfPastDurations', () => {
    const e = estimateFromHistory([h(2), h(4), h(6), h(8), h(10)])
    expect(e?.sampleSize).toBe(5)
    expect(e?.minMs).toBe(h(2))
    expect(e?.medianMs).toBe(h(6))
    expect(e?.maxMs).toBe(h(10))
  })

  it('BuffersTheSuggestionToAnUpperPercentile', () => {
    const e = estimateFromHistory([h(2), h(4), h(6), h(8), h(10)])
    // Default p75 sits above the median.
    expect(e?.suggestedMs).toBeGreaterThan(e?.medianMs ?? 0)
  })

  it('PricesTheSuggestionWhenARateIsGiven', () => {
    const e = estimateFromHistory([h(4), h(4), h(4)], { ratePerHourMinor: 10_000 })
    // All samples 4h → suggestion 4h → 4 × 100.00 = 40000 minor.
    expect(e?.suggestedMs).toBe(h(4))
    expect(e?.suggestedMinor).toBe(40_000)
  })

  it('LeavesPriceNullWithoutARate', () => {
    expect(estimateFromHistory([h(3)])?.suggestedMinor).toBeNull()
  })

  it('DropsUnusableSamples', () => {
    const e = estimateFromHistory([h(4), -1, Number.NaN, Number.POSITIVE_INFINITY, h(8)])
    expect(e?.sampleSize).toBe(2)
  })

  it('IsNullWithNoHistory', () => {
    expect(estimateFromHistory([])).toBeNull()
    expect(estimateFromHistory([-5, Number.NaN])).toBeNull()
  })

  it('HonoursACustomBufferPercentile', () => {
    const e = estimateFromHistory([h(2), h(4), h(6), h(8), h(10)], { bufferPercentile: 0.9 })
    expect(e?.suggestedMs).toBe(e?.p90Ms)
  })
})
