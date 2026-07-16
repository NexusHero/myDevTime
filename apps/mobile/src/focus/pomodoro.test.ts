import { describe, expect, it } from 'vitest'
import {
  DEFAULT_POMODORO_CONFIG,
  advancePhase,
  isBreakPhase,
  phaseDurationMs,
  phaseRemainingMs,
  type PomodoroConfig,
} from './pomodoro.js'

const cfg: PomodoroConfig = {
  focusMs: 25 * 60_000,
  breakMs: 5 * 60_000,
  longBreakMs: 15 * 60_000,
  cyclesBeforeLongBreak: 4,
}

/**
 * The Pomodoro state machine owns only the cadence — focus → break → … → long break.
 * These pin the transitions (short vs. long break by cycle), the phase durations, the
 * break classification, and the remaining-time clamp.
 */
describe('advancePhase', () => {
  it('FocusYieldsAShortBreakAndBumpsTheCount', () => {
    expect(advancePhase('focus', 0, cfg)).toEqual({ phase: 'break', completedFocus: 1 })
  })

  it('EveryFourthFocusYieldsALongBreak', () => {
    // 3 already done; finishing the 4th → long break.
    expect(advancePhase('focus', 3, cfg)).toEqual({ phase: 'longBreak', completedFocus: 4 })
  })

  it('BreakYieldsFocusWithoutChangingTheCount', () => {
    expect(advancePhase('break', 2, cfg)).toEqual({ phase: 'focus', completedFocus: 2 })
    expect(advancePhase('longBreak', 4, cfg)).toEqual({ phase: 'focus', completedFocus: 4 })
  })
})

describe('phaseDurationMs', () => {
  it('MapsEachPhaseToItsConfiguredLength', () => {
    expect(phaseDurationMs('focus', cfg)).toBe(25 * 60_000)
    expect(phaseDurationMs('break', cfg)).toBe(5 * 60_000)
    expect(phaseDurationMs('longBreak', cfg)).toBe(15 * 60_000)
  })
})

describe('isBreakPhase', () => {
  it('BreaksAreBreaks_FocusIsNot', () => {
    expect(isBreakPhase('focus')).toBe(false)
    expect(isBreakPhase('break')).toBe(true)
    expect(isBreakPhase('longBreak')).toBe(true)
  })
})

describe('phaseRemainingMs', () => {
  it('CountsDownAndClampsAtZero', () => {
    expect(phaseRemainingMs(1000, 400)).toBe(600)
    expect(phaseRemainingMs(1000, 1000)).toBe(0)
    expect(phaseRemainingMs(1000, 5000)).toBe(0)
  })
})

describe('DEFAULT_POMODORO_CONFIG', () => {
  it('IsTheClassic25_5_15x4Cadence', () => {
    expect(DEFAULT_POMODORO_CONFIG).toEqual(cfg)
  })
})
