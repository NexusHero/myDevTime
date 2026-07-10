import { describe, expect, it } from 'vitest'
import {
  formatStopwatch,
  getRunning,
  parseEntry,
  parseRunning,
  provisionalEntry,
  startTimer,
  stopTimer,
} from './timer.js'

/**
 * The timer client is the write/read seam for the live timer (REQ-004): it posts
 * start/stop to the NestJS `tracking` entries routes and reads the running entry,
 * mapping each to the typed `TimeEntry` (a running entry has `endedAt: null`).
 * These pin the DTO parse and that each call hits the right path with the right
 * method, exercised through an injected fetch so no network is needed.
 */
const RUNNING = {
  id: 'e1',
  workspaceId: 'w1',
  userId: 'u1',
  projectId: 'p1',
  taskId: null,
  startedAt: '2026-07-10T09:00:00.000Z',
  endedAt: null,
  billable: true,
  source: 'timer',
  note: null,
}

function jsonFetch(
  status: number,
  body: unknown,
): { fetchImpl: typeof fetch; calls: RequestInit[] } {
  const calls: RequestInit[] = []
  const fetchImpl = ((_url: string, init?: RequestInit) => {
    calls.push(init ?? {})
    const text = body === undefined ? '' : JSON.stringify(body)
    return Promise.resolve(new Response(text, { status }))
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

describe('parseEntry', () => {
  it('RunningEntry_HasNullEndedAt', () => {
    const e = parseEntry(RUNNING)
    expect(e.id).toBe('e1')
    expect(e.projectId).toBe('p1')
    expect(e.taskId).toBeNull()
    expect(e.startedAt).toBe('2026-07-10T09:00:00.000Z')
    expect(e.endedAt).toBeNull()
    expect(e.source).toBe('timer')
    expect(e.billable).toBe(true)
  })

  it('MalformedPayload_Throws', () => {
    expect(() => parseEntry({ id: 5 })).toThrow()
    expect(() => parseEntry(null)).toThrow()
  })
})

describe('parseRunning', () => {
  it('NullBody_MeansNoRunningTimer', () => {
    expect(parseRunning(null)).toBeNull()
    expect(parseRunning(undefined)).toBeNull()
  })
  it('EntryBody_ParsesToTimeEntry', () => {
    expect(parseRunning(RUNNING)?.id).toBe('e1')
  })
})

describe('startTimer', () => {
  it('PostsToStartRouteAndReturnsEntry', async () => {
    const { fetchImpl, calls } = jsonFetch(201, RUNNING)
    const entry = await startTimer('http://api', { projectId: 'p1' }, fetchImpl)
    expect(entry.id).toBe('e1')
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.body).toBe(JSON.stringify({ projectId: 'p1' }))
  })
})

describe('stopTimer', () => {
  it('PostsToStopRouteAndReturnsStoppedEntry', async () => {
    const stopped = { ...RUNNING, endedAt: '2026-07-10T10:00:00.000Z' }
    const { fetchImpl, calls } = jsonFetch(200, stopped)
    const entry = await stopTimer('http://api', undefined, fetchImpl)
    expect(entry.endedAt).toBe('2026-07-10T10:00:00.000Z')
    expect(calls[0]?.method).toBe('POST')
  })
})

describe('getRunning', () => {
  it('RunningEntry_IsReturned', async () => {
    const { fetchImpl } = jsonFetch(200, RUNNING)
    expect((await getRunning('http://api', fetchImpl))?.id).toBe('e1')
  })
  it('EmptyBody_MeansNoTimer', async () => {
    const { fetchImpl } = jsonFetch(200, undefined)
    expect(await getRunning('http://api', fetchImpl)).toBeNull()
  })
})

describe('formatStopwatch', () => {
  it('ZeroMs_IsAllZeros', () => {
    expect(formatStopwatch(0)).toBe('00:00:00')
  })
  it('MinutesAndSeconds_ZeroPad', () => {
    expect(formatStopwatch(42 * 60_000 + 11_000)).toBe('00:42:11')
  })
  it('BeyondAnHour_HoursGrow', () => {
    expect(formatStopwatch(25 * 3_600_000 + 3_000)).toBe('25:00:03')
  })
  it('NegativeOrNaN_ClampToZero', () => {
    expect(formatStopwatch(-5000)).toBe('00:00:00')
    expect(formatStopwatch(Number.NaN)).toBe('00:00:00')
  })
})

describe('provisionalEntry', () => {
  it('BuildsRunningEntryFromInputAndStart', () => {
    const e = provisionalEntry({ projectId: 'p1' }, new Date('2026-07-10T09:00:00.000Z'))
    expect(e.endedAt).toBeNull()
    expect(e.source).toBe('timer')
    expect(e.projectId).toBe('p1')
    expect(e.startedAt).toBe('2026-07-10T09:00:00.000Z')
    expect(e.billable).toBe(true) // default
  })
  it('DefaultsAreNullAndBillable', () => {
    const e = provisionalEntry({}, new Date('2026-07-10T09:00:00.000Z'))
    expect(e.projectId).toBeNull()
    expect(e.taskId).toBeNull()
    expect(e.note).toBeNull()
  })
})
