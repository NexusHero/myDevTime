import { describe, expect, it } from 'vitest'
import type { StartTimerInput, TimeEntry } from '../api/timer.js'
import { reconcileTimer, type PersistedTimerSession } from './reconcile.js'

function running(id = 'e1'): TimeEntry {
  return {
    id,
    projectId: 'p1',
    taskId: null,
    startedAt: '2026-07-15T09:00:00.000Z',
    endedAt: null,
    billable: true,
    source: 'timer',
    note: null,
  }
}

const pausedCtx: StartTimerInput = { projectId: 'p1', billable: true, note: 'resume me' }

function session(over: Partial<PersistedTimerSession> = {}): PersistedTimerSession {
  return { accumulatedMs: 0, pausedInput: null, ...over }
}

describe('reconcileTimer', () => {
  it('ServerRunning_NoPersisted_RestoresRunningFromZero', () => {
    expect(reconcileTimer(running(), null)).toEqual({
      running: running(),
      accumulatedMs: 0,
      pausedInput: null,
    })
  })

  it('ServerRunning_WithBankedTime_KeepsAccumulatedAndDropsPausedFlag', () => {
    // Inconsistent persisted state (paused) but the server says a segment runs —
    // running wins, the banked time is preserved, the stale pause flag is dropped.
    const out = reconcileTimer(
      running(),
      session({ accumulatedMs: 600_000, pausedInput: pausedCtx }),
    )
    expect(out).toEqual({ running: running(), accumulatedMs: 600_000, pausedInput: null })
  })

  it('NoServerRunning_PersistedPaused_RestoresThePausedSession', () => {
    const out = reconcileTimer(null, session({ accumulatedMs: 1_500_000, pausedInput: pausedCtx }))
    expect(out).toEqual({ running: null, accumulatedMs: 1_500_000, pausedInput: pausedCtx })
  })

  it('NoServerRunning_NoPersisted_IsIdle', () => {
    expect(reconcileTimer(null, null)).toEqual({
      running: null,
      accumulatedMs: 0,
      pausedInput: null,
    })
  })

  it('NoServerRunning_BankedButNotPaused_CollapsesToIdle', () => {
    // Banked time with no running segment and no paused context can't be resumed.
    const out = reconcileTimer(null, session({ accumulatedMs: 999_000, pausedInput: null }))
    expect(out).toEqual({ running: null, accumulatedMs: 0, pausedInput: null })
  })

  it('NegativeOrZeroAccumulated_ClampsToZero', () => {
    const out = reconcileTimer(running(), session({ accumulatedMs: -42, pausedInput: null }))
    expect(out.accumulatedMs).toBe(0)
  })
})
