import { describe, expect, it } from 'vitest'
import { shouldRemindToTrack, type ReminderInput } from './reminder.js'

const MIN = 60_000
const base: ReminderInput = {
  punchedIn: true,
  timerActive: false,
  clockedInSinceMs: 0,
  nowMs: 15 * MIN,
  dismissed: false,
}

describe('shouldRemindToTrack', () => {
  it('ClockedInPastThreshold_WithNoTimer_Reminds', () => {
    expect(shouldRemindToTrack(base)).toBe(true)
  })

  it('BeforeTheThreshold_StaysQuiet', () => {
    expect(shouldRemindToTrack({ ...base, nowMs: 5 * MIN })).toBe(false)
  })

  it('AtExactlyTheThreshold_Reminds', () => {
    expect(shouldRemindToTrack({ ...base, nowMs: 10 * MIN })).toBe(true)
  })

  it('TimerActive_NeverReminds', () => {
    expect(shouldRemindToTrack({ ...base, timerActive: true })).toBe(false)
  })

  it('NotClockedIn_NeverReminds', () => {
    expect(shouldRemindToTrack({ ...base, punchedIn: false })).toBe(false)
    expect(shouldRemindToTrack({ ...base, clockedInSinceMs: null })).toBe(false)
  })

  it('Dismissed_StaysQuiet', () => {
    expect(shouldRemindToTrack({ ...base, dismissed: true })).toBe(false)
  })

  it('RespectsACustomThreshold', () => {
    expect(shouldRemindToTrack({ ...base, nowMs: 7 * MIN, thresholdMs: 6 * MIN })).toBe(true)
    expect(shouldRemindToTrack({ ...base, nowMs: 7 * MIN, thresholdMs: 8 * MIN })).toBe(false)
  })
})
