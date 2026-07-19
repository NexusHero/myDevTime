import { describe, expect, it } from 'vitest'
import { AppleCalendar, type EventKitSource, type RawAppleEvent } from './apple-calendar.js'
import { CalendarUnavailableError, type CalendarRange } from './port.js'

/**
 * The Apple EventKit adapter — proven against a fake native seam, no device. Confirms
 * that an available seam maps raw EventKit events → `ExternalEvent` (title fallback,
 * skip rules), and — critically — that a host WITHOUT EventKit (server/web/CI: no
 * seam supplied, or an unavailable one) is honestly unavailable and NEVER fabricates
 * events, degrading to `CalendarUnavailableError` (ADR-0005) exactly like NullCalendar.
 */

const RANGE: CalendarRange = {
  fromMs: Date.parse('2026-07-01T00:00:00.000Z'),
  toMs: Date.parse('2026-07-08T00:00:00.000Z'),
}

/** A fake native seam that is available and returns `events`. */
function availableSource(events: readonly RawAppleEvent[]): EventKitSource {
  return { available: () => true, events: () => Promise.resolve(events) }
}

describe('AppleCalendar without EventKit (server/web/CI)', () => {
  it('NoSourceSupplied_IsUnavailable_AndFetchThrows', async () => {
    const cal = new AppleCalendar()
    expect(await cal.available()).toBe(false)
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
    await expect(cal.fetchEvents(RANGE)).rejects.toMatchObject({ provider: 'apple' })
  })

  it('UnavailableSource_IsUnavailable_AndNeverReadsEvents', async () => {
    let read = false
    const cal = new AppleCalendar({
      source: {
        available: () => false,
        events: () => {
          read = true
          return Promise.resolve([])
        },
      },
    })
    expect(await cal.available()).toBe(false)
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
    // It refuses before touching the seam — no fabricated read.
    expect(read).toBe(false)
  })
})

describe('AppleCalendar with a native EventKit seam', () => {
  it('Available_MapsRawEvents_WithTitleFallback', async () => {
    const cal = new AppleCalendar({
      source: availableSource([
        {
          identifier: 'ek-1',
          title: 'Standup',
          startMs: Date.parse('2026-07-02T09:00:00.000Z'),
          endMs: Date.parse('2026-07-02T09:30:00.000Z'),
        },
        {
          identifier: 'ek-2',
          title: '   ',
          startMs: Date.parse('2026-07-03T12:00:00.000Z'),
          endMs: Date.parse('2026-07-03T13:00:00.000Z'),
        },
        {
          identifier: 'ek-3',
          title: null,
          startMs: Date.parse('2026-07-04T12:00:00.000Z'),
          endMs: Date.parse('2026-07-04T13:00:00.000Z'),
        },
      ]),
    })

    expect(await cal.available()).toBe(true)
    expect(await cal.fetchEvents(RANGE)).toEqual([
      {
        uid: 'ek-1',
        startMs: Date.parse('2026-07-02T09:00:00.000Z'),
        endMs: Date.parse('2026-07-02T09:30:00.000Z'),
        title: 'Standup',
      },
      {
        uid: 'ek-2',
        startMs: Date.parse('2026-07-03T12:00:00.000Z'),
        endMs: Date.parse('2026-07-03T13:00:00.000Z'),
        title: '(no title)',
      },
      {
        uid: 'ek-3',
        startMs: Date.parse('2026-07-04T12:00:00.000Z'),
        endMs: Date.parse('2026-07-04T13:00:00.000Z'),
        title: '(no title)',
      },
    ])
  })

  it('SkipsMissingIdentifierAndUnparseableInstants', async () => {
    const cal = new AppleCalendar({
      source: availableSource([
        { identifier: '', title: 'no id', startMs: RANGE.fromMs, endMs: RANGE.toMs },
        { identifier: 'nan-start', title: 'bad', startMs: Number.NaN, endMs: RANGE.toMs },
        { identifier: 'nan-end', title: 'bad', startMs: RANGE.fromMs, endMs: Number.NaN },
        {
          identifier: 'good',
          title: 'Kept',
          startMs: Date.parse('2026-07-02T14:00:00.000Z'),
          endMs: Date.parse('2026-07-02T15:00:00.000Z'),
        },
      ]),
    })
    const events = await cal.fetchEvents(RANGE)
    expect(events.map(e => e.uid)).toEqual(['good'])
  })

  it('EmptyRange_ReturnsNoEvents', async () => {
    const cal = new AppleCalendar({ source: availableSource([]) })
    expect(await cal.fetchEvents(RANGE)).toEqual([])
  })

  it('SeamReadRejects_DegradesToUnavailable', async () => {
    const cal = new AppleCalendar({
      source: {
        available: () => true,
        events: () => Promise.reject(new Error('EKEventStore denied')),
      },
    })
    await expect(cal.fetchEvents(RANGE)).rejects.toBeInstanceOf(CalendarUnavailableError)
    await expect(cal.fetchEvents(RANGE)).rejects.toMatchObject({ provider: 'apple' })
  })
})
