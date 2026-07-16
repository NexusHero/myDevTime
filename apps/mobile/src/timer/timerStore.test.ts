// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { loadTimerSession, saveTimerSession } from './timerStore.js'

afterEach(() => {
  saveTimerSession(null)
})

describe('timerStore', () => {
  it('SaveThenLoad_RoundTripsThePausedSession', () => {
    saveTimerSession({
      accumulatedMs: 1_800_000,
      pausedInput: { projectId: 'p1', note: 'x' },
      pausedSinceMs: 1_700_000_000_000,
    })
    expect(loadTimerSession()).toEqual({
      accumulatedMs: 1_800_000,
      pausedInput: { projectId: 'p1', note: 'x' },
      pausedSinceMs: 1_700_000_000_000,
    })
  })

  it('LoadWithNothingStored_ReturnsNull', () => {
    expect(loadTimerSession()).toBeNull()
  })

  it('SaveNull_ClearsThePersistedSession', () => {
    saveTimerSession({ accumulatedMs: 5_000, pausedInput: null })
    saveTimerSession(null)
    expect(loadTimerSession()).toBeNull()
  })

  it('LoadCorruptJson_ReturnsNullInsteadOfThrowing', () => {
    localStorage.setItem('mydevtime.timer.session', '{not json')
    expect(loadTimerSession()).toBeNull()
  })

  it('LoadMalformedShape_FallsBackToSafeDefaults', () => {
    localStorage.setItem('mydevtime.timer.session', JSON.stringify({ accumulatedMs: 'nope' }))
    expect(loadTimerSession()).toEqual({ accumulatedMs: 0, pausedInput: null, pausedSinceMs: null })
  })
})
