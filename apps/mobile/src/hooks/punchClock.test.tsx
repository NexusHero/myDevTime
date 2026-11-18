// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import type { TimeEntry } from '../api/timer.js'
import type { Shift } from '../api/worktime.js'

/**
 * Stop/pause/clock-out in `useTimer` and `useWorktime` (REQ-004, REQ-028). Pinned here:
 * each action issues exactly ONE request (rendered under StrictMode; the request is fired
 * from the callback, never from inside a state updater, which React may re-run), the state
 * clears optimistically, and a failed request rolls the running entry/shift back.
 */

const seams = vi.hoisted(() => ({
  stopTimer: vi.fn(),
  getRunning: vi.fn(),
  clockOut: vi.fn(),
  getRunningShift: vi.fn(),
}))

vi.mock('../config.js', () => ({ apiBaseUrl: 'https://api.test' }))
vi.mock('../api/timer.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../api/timer.js')>()),
  stopTimer: (...args: unknown[]) => seams.stopTimer(...args) as unknown,
  getRunning: (...args: unknown[]) => seams.getRunning(...args) as unknown,
}))
vi.mock('../timer/timerStore.js', () => ({
  loadTimerSession: () => null,
  saveTimerSession: () => undefined,
  timerSessionReady: () => Promise.resolve(),
}))
vi.mock('../api/worktime.js', () => ({
  clockIn: vi.fn(),
  clockOut: (...args: unknown[]) => seams.clockOut(...args) as unknown,
  getRunningShift: (...args: unknown[]) => seams.getRunningShift(...args) as unknown,
  listShifts: () => Promise.resolve([]),
  fetchWorktimeSummary: () => Promise.resolve({ workedMs: 0, targetMs: 0, balanceMs: 0 }),
}))

const { useTimer } = await import('./useTimer.js')
const { useWorktime } = await import('./useWorktime.js')

const startedAt = new Date(Date.now() - 60_000).toISOString()
const entry = {
  id: 'e1',
  startedAt,
  endedAt: null,
  billable: true,
  source: 'timer',
} as unknown as TimeEntry
const shift: Shift = {
  id: 's1',
  startedAt,
  endedAt: null,
  breakMs: 0,
  source: 'clock',
  breakShortfallMs: 0,
}

function mount<T>(hook: () => T): { current: () => T } {
  let value: T | undefined
  function Probe(): null {
    value = hook()
    return null
  }
  act(() => {
    TestRenderer.create(
      <StrictMode>
        <Probe />
      </StrictMode>,
    )
  })
  return {
    current: () => {
      if (value === undefined) throw new Error('hook not rendered')
      return value
    },
  }
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  seams.getRunning.mockResolvedValue(entry)
  seams.getRunningShift.mockResolvedValue(shift)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useTimer', () => {
  it('pause stops the segment with exactly one request and banks its time', async () => {
    seams.stopTimer.mockResolvedValue(undefined)
    const timer = mount(useTimer)
    await flush()

    act(() => {
      timer.current().pause()
    })
    await flush()

    expect(seams.stopTimer).toHaveBeenCalledTimes(1)
    expect(timer.current().running).toBeNull()
    expect(timer.current().paused).toBe(true)
    expect(timer.current().accumulatedMs).toBeGreaterThan(0)
  })

  it('pause rolls back when the stop request fails', async () => {
    seams.stopTimer.mockRejectedValue(new Error('offline'))
    const timer = mount(useTimer)
    await flush()

    act(() => {
      timer.current().pause()
    })
    await flush()

    expect(timer.current().running?.id).toBe('e1')
    expect(timer.current().paused).toBe(false)
    expect(timer.current().accumulatedMs).toBe(0)
    expect(timer.current().error?.message).toBe('offline')
  })

  it('punchOut stops with exactly one request and rolls back on failure', async () => {
    seams.stopTimer.mockRejectedValue(new Error('offline'))
    const timer = mount(useTimer)
    await flush()

    act(() => {
      timer.current().punchOut('2026-11-18T10:00:00.000Z')
    })
    await flush()

    expect(seams.stopTimer).toHaveBeenCalledTimes(1)
    expect(seams.stopTimer).toHaveBeenCalledWith('https://api.test', '2026-11-18T10:00:00.000Z')
    expect(timer.current().running?.id).toBe('e1')
  })

  it('punchOut with nothing running sends no request', async () => {
    seams.getRunning.mockResolvedValue(null)
    const timer = mount(useTimer)
    await flush()

    act(() => {
      timer.current().punchOut()
    })
    await flush()

    expect(seams.stopTimer).not.toHaveBeenCalled()
  })
})

describe('useWorktime', () => {
  it('clockOut clears the shift with exactly one request', async () => {
    seams.clockOut.mockResolvedValue(undefined)
    const worktime = mount(useWorktime)
    await flush()
    seams.getRunningShift.mockResolvedValue(null) // the server's view after the clock-out

    act(() => {
      worktime.current().clockOut()
    })
    await flush()

    expect(seams.clockOut).toHaveBeenCalledTimes(1)
    expect(worktime.current().running).toBeNull()
  })

  it('clockOut rolls the shift back when the request fails', async () => {
    seams.clockOut.mockRejectedValue(new Error('offline'))
    const worktime = mount(useWorktime)
    await flush()

    act(() => {
      worktime.current().clockOut()
    })
    await flush()

    expect(worktime.current().running?.id).toBe('s1')
    expect(worktime.current().error?.message).toBe('offline')
  })
})
