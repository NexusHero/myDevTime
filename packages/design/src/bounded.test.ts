import { describe, expect, it } from 'vitest'
import { boundedList } from './bounded.js'

describe('boundedList (bounded screens)', () => {
  const five = ['a', 'b', 'c', 'd', 'e'] as const

  it('ShortList_FitsWithinLimit_ShownWholeNoHidden', () => {
    const r = boundedList(five, 5)
    expect(r.shown).toEqual(five)
    expect(r.hidden).toBe(0)
  })

  it('LongList_ShowsTheHeadAndCountsTheRest', () => {
    const r = boundedList(five, 3)
    expect(r.shown).toEqual(['a', 'b', 'c'])
    expect(r.hidden).toBe(2)
  })

  it('Expanded_ShowsEverythingRegardlessOfLimit', () => {
    const r = boundedList(five, 3, true)
    expect(r.shown).toEqual(five)
    expect(r.hidden).toBe(0)
  })

  it('ZeroLimit_HidesAll', () => {
    const r = boundedList(five, 0)
    expect(r.shown).toEqual([])
    expect(r.hidden).toBe(5)
  })

  it('NegativeLimit_ClampsToZero', () => {
    expect(boundedList(five, -3).hidden).toBe(5)
    expect(boundedList(five, -3).shown).toEqual([])
  })

  it('NonIntegerLimit_IsFloored', () => {
    const r = boundedList(five, 2.9)
    expect(r.shown).toEqual(['a', 'b'])
    expect(r.hidden).toBe(3)
  })

  it('EmptyList_IsAlwaysWholeAndEmpty', () => {
    const r = boundedList([], 3)
    expect(r.shown).toEqual([])
    expect(r.hidden).toBe(0)
  })

  it('ExactlyAtLimit_NoHidden', () => {
    expect(boundedList(five, 5).hidden).toBe(0)
    expect(boundedList(['a', 'b'], 2).hidden).toBe(0)
  })
})
