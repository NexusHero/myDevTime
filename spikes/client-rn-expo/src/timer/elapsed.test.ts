import { describe, expect, it } from 'vitest'
import { STOPPED, elapsedMs, isRunning, pause, start, stop } from './elapsed.js'

/**
 * Q1 evidence. These prove the property that matters for background/kill/reboot
 * survival: elapsed is a pure function of persisted timestamps and the wall
 * clock, so an arbitrarily long gap between `start` and the next observation is
 * accounted for exactly — no ticks required.
 */
const T0 = 1_700_000_000_000 // fixed epoch-ms; no Date.now() in tests

describe('timer elapsed math', () => {
  it('Elapsed_WhileRunning_DerivesFromWallClock', () => {
    const s = start(STOPPED, T0)
    expect(elapsedMs(s, T0 + 5_000)).toBe(5_000)
    expect(isRunning(s)).toBe(true)
  })

  it('Elapsed_AfterLongBackgroundGap_CountsTheFullGap', () => {
    // Simulates: start, app backgrounded/killed for 3h, cold-start re-derives.
    const s = start(STOPPED, T0)
    const threeHours = 3 * 60 * 60 * 1000
    expect(elapsedMs(s, T0 + threeHours)).toBe(threeHours)
  })

  it('Elapsed_AcrossRebootRehydration_IsUnchanged', () => {
    // Persisted state is just {startedAt, accumulatedMs}; rehydrate == identity.
    const s = start(STOPPED, T0)
    const persisted: typeof s = JSON.parse(JSON.stringify(s))
    const oneDay = 24 * 60 * 60 * 1000
    expect(elapsedMs(persisted, T0 + oneDay)).toBe(oneDay)
  })

  it('PauseResume_AccumulatesSegments', () => {
    let s = start(STOPPED, T0)
    s = pause(s, T0 + 60_000) // 1 min tracked
    expect(isRunning(s)).toBe(false)
    expect(elapsedMs(s, T0 + 5_000_000)).toBe(60_000) // paused: frozen
    s = start(s, T0 + 100_000)
    expect(elapsedMs(s, T0 + 130_000)).toBe(90_000) // +30s
  })

  it('BackwardsClock_NeverShrinksTheTotal', () => {
    const s = start(STOPPED, T0)
    expect(elapsedMs(s, T0 - 10_000)).toBe(0) // clamped, not negative
    expect(pause(s, T0 - 10_000).accumulatedMs).toBe(0)
  })

  it('Start_WhenAlreadyRunning_IsNoOp', () => {
    const s = start(STOPPED, T0)
    expect(start(s, T0 + 9_999)).toEqual(s) // second start ignored
  })

  it('Stop_ProducesEpochIntervalForTheDomain', () => {
    let s = start(STOPPED, T0)
    s = pause(s, T0 + 30_000)
    s = start(s, T0 + 40_000)
    const { entry, state } = stop(s, T0 + 70_000) // 30s + 30s = 60s
    expect(state).toEqual(STOPPED)
    expect(entry).not.toBeNull()
    expect(entry!.endedAt - entry!.startedAt).toBe(60_000)
  })

  it('Stop_WithNothingTracked_YieldsNoEntry', () => {
    expect(stop(STOPPED, T0).entry).toBeNull()
  })
})
