import { describe, expect, it } from 'vitest'
import { formatIdle, idleReturn, type IdleReturnInput } from './idleReturn.js'

const MIN = 60_000
const base: IdleReturnInput = {
  lastActiveAt: 0,
  now: 15 * MIN,
  timerRunning: true,
}

describe('idleReturn', () => {
  it('AwayPastThreshold_WhileTheTimerRuns_ReportsTheIdleStretch', () => {
    expect(idleReturn(base)).toEqual({ idleMs: 15 * MIN })
  })

  it('AtExactlyTheThreshold_Reports', () => {
    expect(idleReturn({ ...base, now: 10 * MIN })).toEqual({ idleMs: 10 * MIN })
  })

  it('JustBelowTheThreshold_StaysQuiet', () => {
    expect(idleReturn({ ...base, now: 10 * MIN - 1 })).toBeNull()
  })

  it('TimerOff_NeverReports', () => {
    expect(idleReturn({ ...base, timerRunning: false })).toBeNull()
  })

  it('NegativeClockSkew_IsNoiseNotAnAbsence', () => {
    expect(idleReturn({ ...base, lastActiveAt: 20 * MIN, now: 15 * MIN })).toBeNull()
  })

  it('NonFiniteInstants_StayQuiet', () => {
    expect(idleReturn({ ...base, lastActiveAt: Number.NaN })).toBeNull()
  })

  it('RespectsACustomThreshold', () => {
    expect(idleReturn({ ...base, now: 5 * MIN, thresholdMs: 4 * MIN })).toEqual({
      idleMs: 5 * MIN,
    })
    expect(idleReturn({ ...base, now: 5 * MIN, thresholdMs: 6 * MIN })).toBeNull()
  })
})

describe('formatIdle', () => {
  it('RendersTheAppWideDurationLabel', () => {
    expect(formatIdle(12 * MIN)).toBe('0:12 h')
    expect(formatIdle(90 * MIN)).toBe('1:30 h')
  })
})
