import { describe, expect, it } from 'vitest'
import { fnv1a } from './hash.js'

describe('fnv1a', () => {
  it('IsDeterministic', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'))
  })

  it('ReturnsAnUnsigned32BitInteger', () => {
    for (const id of ['', 'a', 'partner-anna', 'x'.repeat(64)]) {
      const h = fnv1a(id)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(0xffffffff)
    }
  })

  it('DifferentInputs_DifferentHashes', () => {
    expect(fnv1a('a')).not.toBe(fnv1a('b'))
  })

  it('EmptyString_IsTheFnvOffsetBasis', () => {
    expect(fnv1a('')).toBe(2166136261)
  })
})
