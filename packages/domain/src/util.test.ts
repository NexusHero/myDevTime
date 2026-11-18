import { describe, expect, it } from 'vitest'
import { assertNever, clamp, compareStrings, stripTrailingSlashes } from './util.js'

describe('clamp', () => {
  it('Clamp_ValueInsideRange_ReturnsValueUnchanged', () => {
    const result = clamp(5, 0, 10)

    expect(result).toBe(5)
  })

  it('Clamp_ValueBelowMin_ReturnsMin', () => {
    const result = clamp(-3, 0, 10)

    expect(result).toBe(0)
  })

  it('Clamp_ValueAboveMax_ReturnsMax', () => {
    const result = clamp(42, 0, 10)

    expect(result).toBe(10)
  })

  it('Clamp_ValueOnBoundary_ReturnsBoundary', () => {
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('Clamp_InvertedRange_ThrowsError', () => {
    const act = (): number => clamp(5, 10, 0)

    expect(act).toThrow(/invalid range/)
  })
})

describe('assertNever', () => {
  it('AssertNever_Called_ThrowsWithSerializedValue', () => {
    // Cast is the whole point: at runtime an unhandled case would arrive here.
    const act = (): never => assertNever('unexpected' as never)

    expect(act).toThrow(/Unhandled case/)
  })
})

describe('compareStrings', () => {
  it('CompareStrings_SortsByCodeUnit_LocaleIndependent', () => {
    const result = ['b', 'B', 'a', '2026-02-01', '2026-01-31', 'ä'].sort(compareStrings)

    expect(result).toEqual(['2026-01-31', '2026-02-01', 'B', 'a', 'b', 'ä'])
  })

  it('CompareStrings_EqualStrings_ReturnsZero', () => {
    expect(compareStrings('x', 'x')).toBe(0)
  })
})

describe('stripTrailingSlashes', () => {
  it('StripTrailingSlashes_RemovesEveryTrailingSlash', () => {
    expect(stripTrailingSlashes('https://a.test/x///')).toBe('https://a.test/x')
  })

  it('StripTrailingSlashes_NoTrailingSlash_ReturnsInputUnchanged', () => {
    expect(stripTrailingSlashes('https://a.test/x')).toBe('https://a.test/x')
  })

  it('StripTrailingSlashes_OnlySlashes_ReturnsEmpty', () => {
    expect(stripTrailingSlashes('////')).toBe('')
  })

  it('StripTrailingSlashes_LongSlashRun_IsLinear', () => {
    const input = `${'/'.repeat(200_000)}x${'/'.repeat(200_000)}`

    expect(stripTrailingSlashes(input)).toHaveLength(200_001)
  })
})
