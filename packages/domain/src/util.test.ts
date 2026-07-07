import { describe, expect, it } from 'vitest'
import { assertNever, clamp } from './util.js'

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
