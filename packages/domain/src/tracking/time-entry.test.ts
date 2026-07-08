import { describe, expect, it } from 'vitest'
import { entryDuration, isRunning, isValidEntry, type TimeEntry } from './time-entry.js'
import { HOUR_MS } from './time.js'

const base: TimeEntry = {
  id: 'e1',
  start: 1000,
  end: 1000 + HOUR_MS,
  billable: true,
  source: 'timer',
}

describe('time-entry', () => {
  it('IsRunning_NullEnd_IsTrue', () => {
    expect(isRunning({ ...base, end: null })).toBe(true)
    expect(isRunning(base)).toBe(false)
  })

  it('EntryDuration_Completed_IsEndMinusStart', () => {
    expect(entryDuration(base)).toBe(HOUR_MS)
  })

  it('EntryDuration_RunningWithAsOf_MeasuresToAsOf', () => {
    expect(entryDuration({ ...base, end: null }, 1000 + 2 * HOUR_MS)).toBe(2 * HOUR_MS)
  })

  it('EntryDuration_RunningWithoutAsOf_Throws', () => {
    expect(() => entryDuration({ ...base, end: null })).toThrow(/asOf/)
  })

  it('EntryDuration_EndBeforeStart_Throws', () => {
    expect(() => entryDuration({ ...base, end: 500 })).toThrow(/precedes/)
  })

  it('IsValidEntry_RunningOrEndAtOrAfterStart_IsTrue', () => {
    expect(isValidEntry(base)).toBe(true)
    expect(isValidEntry({ ...base, end: null })).toBe(true)
    expect(isValidEntry({ ...base, end: base.start })).toBe(true)
    expect(isValidEntry({ ...base, end: 500 })).toBe(false)
  })
})
