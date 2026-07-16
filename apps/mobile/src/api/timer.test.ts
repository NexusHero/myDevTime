import { describe, expect, it } from 'vitest'
import {
  entryDurationMs,
  formatStopwatch,
  getRunning,
  listEntries,
  patchEntryBillable,
  parseEntries,
  parseEntry,
  parseRunning,
  pauseDurationMs,
  provisionalEntry,
  resumeInput,
  sessionElapsedMs,
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

describe('patchEntryBillable', () => {
  it('PatchesTheEntryRouteWithTheBillableFlag', async () => {
    let seenUrl = ''
    const calls: RequestInit[] = []
    const fetchImpl = ((url: string, init?: RequestInit) => {
      seenUrl = url
      calls.push(init ?? {})
      return Promise.resolve(
        new Response(JSON.stringify({ ...RUNNING, billable: false }), { status: 200 }),
      )
    }) as unknown as typeof fetch
    const entry = await patchEntryBillable('http://api', 'e1', false, fetchImpl)
    expect(seenUrl).toBe('http://api/api/tracking/entries/e1')
    expect(calls[0]?.method).toBe('PATCH')
    expect(calls[0]?.body).toBe(JSON.stringify({ billable: false }))
    expect(entry.billable).toBe(false)
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

describe('pauseDurationMs', () => {
  it('NotPaused_IsZero', () => {
    expect(pauseDurationMs(null, new Date('2026-07-10T09:05:00Z'))).toBe(0)
  })
  it('CountsFromPausedSince', () => {
    const since = Date.parse('2026-07-10T09:00:00Z')
    expect(pauseDurationMs(since, new Date('2026-07-10T09:03:20Z'))).toBe(200_000)
  })
  it('ClampsANegativeDeltaToZero', () => {
    const since = Date.parse('2026-07-10T09:05:00Z')
    expect(pauseDurationMs(since, new Date('2026-07-10T09:00:00Z'))).toBe(0)
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

describe('parseEntries', () => {
  it('ParsesAnArrayOfEntries', () => {
    const rows = parseEntries([RUNNING, { ...RUNNING, id: 'e2' }])
    expect(rows.map(e => e.id)).toEqual(['e1', 'e2'])
  })
  it('NonArray_Throws', () => {
    expect(() => parseEntries({})).toThrow()
  })
})

describe('listEntries', () => {
  it('GetsEntriesAndPassesDateRange', async () => {
    const stopped = { ...RUNNING, endedAt: '2026-07-10T10:00:00.000Z' }
    const seen: string[] = []
    const fetchImpl = ((url: string) => {
      seen.push(url)
      return Promise.resolve(new Response(JSON.stringify([stopped]), { status: 200 }))
    }) as unknown as typeof fetch
    const rows = await listEntries(
      'http://api',
      { from: '2026-07-01T00:00:00.000Z', to: '2026-07-31T00:00:00.000Z' },
      fetchImpl,
    )
    expect(rows).toHaveLength(1)
    expect(seen[0]).toContain('/api/tracking/entries?')
    expect(seen[0]).toContain('from=')
    expect(seen[0]).toContain('to=')
  })
  it('NoRange_HitsBarePath', async () => {
    const fetchImpl = ((url: string) => {
      expect(url).toBe('http://api/api/tracking/entries')
      return Promise.resolve(new Response('[]', { status: 200 }))
    }) as unknown as typeof fetch
    expect(await listEntries('http://api', {}, fetchImpl)).toEqual([])
  })
})

describe('entryDurationMs', () => {
  it('ClosedEntry_IsEndMinusStart', () => {
    const e = { ...RUNNING, endedAt: '2026-07-10T09:30:00.000Z' }
    expect(entryDurationMs(e, new Date('2026-07-10T12:00:00.000Z'))).toBe(30 * 60_000)
  })
  it('RunningEntry_CountsUpToNow', () => {
    expect(entryDurationMs(RUNNING, new Date('2026-07-10T09:05:00.000Z'))).toBe(5 * 60_000)
  })
  it('Inverted_ClampsToZero', () => {
    const e = { ...RUNNING, endedAt: '2026-07-10T08:00:00.000Z' }
    expect(entryDurationMs(e, new Date('2026-07-10T09:00:00.000Z'))).toBe(0)
  })
})

describe('sessionElapsedMs — real pause', () => {
  it('AddsTheRunningSegmentToTheAccumulatedTotal', () => {
    // 10 min already banked from a prior segment + 5 min of the running one.
    const total = sessionElapsedMs(10 * 60_000, RUNNING, new Date('2026-07-10T09:05:00.000Z'))
    expect(total).toBe(15 * 60_000)
  })
  it('WhenPausedIsJustTheAccumulatedTotal', () => {
    // running === null → paused: the total freezes at what was banked.
    expect(sessionElapsedMs(15 * 60_000, null, new Date('2026-07-10T10:00:00.000Z'))).toBe(
      15 * 60_000,
    )
  })
  it('TreatsNegativeOrNaNAccumulatedAsZero', () => {
    expect(sessionElapsedMs(-1, null, new Date())).toBe(0)
    expect(sessionElapsedMs(Number.NaN, null, new Date())).toBe(0)
  })
})

describe('resumeInput', () => {
  it('CarriesTheProjectTaskBillableAndNoteToTheNextSegment', () => {
    const e = { ...RUNNING, projectId: 'p9', taskId: 't3', billable: false, note: 'auth bug' }
    expect(resumeInput(e)).toEqual({
      projectId: 'p9',
      taskId: 't3',
      billable: false,
      note: 'auth bug',
    })
  })
})
