import { describe, expect, it } from 'vitest'
import type { ExternalEvent, ImportedBlock } from '@mydevtime/domain'
import { planImport } from './service.js'
import { NullCalendar } from './null-calendar.js'
import { CalendarUnavailableError, type CalendarPort, type CalendarRange } from './port.js'

const H = 60 * 60 * 1000
const T0 = 1_700_000_000_000
const range: CalendarRange = { fromMs: T0, toMs: T0 + 24 * H }

/** A tiny in-memory calendar adapter for the seam tests — the live vendor adapters are spike-gated. */
class FakeCalendar implements CalendarPort {
  readonly provider = 'google' as const
  constructor(
    private readonly events: readonly ExternalEvent[],
    private readonly up = true,
  ) {}
  available(): Promise<boolean> {
    return Promise.resolve(this.up)
  }
  fetchEvents(_range: CalendarRange): Promise<readonly ExternalEvent[]> {
    if (!this.up) return Promise.reject(new CalendarUnavailableError('google'))
    return Promise.resolve(this.events)
  }
}

describe('planImport', () => {
  const ev: ExternalEvent = { uid: 'a', startMs: T0 + H, endMs: T0 + 2 * H, title: 'Standup' }

  it('WithoutConsent_ProposesNothing_EvenWhenEventsExist', async () => {
    const plan = await planImport(new FakeCalendar([ev]), [], range, false)
    expect(plan.status).toBe('no-consent')
    expect(plan.proposal.changes).toEqual([])
  })

  it('WithConsent_ProposesTheNewEventsAsGhosts', async () => {
    const plan = await planImport(new FakeCalendar([ev]), [], range, true)
    expect(plan.status).toBe('ok')
    expect(plan.proposal.changes).toEqual([{ kind: 'new', event: ev }])
  })

  it('AlreadyImported_ProposesNothing', async () => {
    const imported: ImportedBlock[] = [
      { uid: 'a', startMs: T0 + H, endMs: T0 + 2 * H, title: 'Standup' },
    ]
    const plan = await planImport(new FakeCalendar([ev]), imported, range, true)
    expect(plan.status).toBe('ok')
    expect(plan.proposal.changes).toEqual([])
    expect(plan.proposal.unchangedCount).toBe(1)
  })

  it('UnavailableProvider_DegradesToEmptyPlan', async () => {
    const plan = await planImport(new FakeCalendar([ev], false), [], range, true)
    expect(plan.status).toBe('unavailable')
    expect(plan.proposal.changes).toEqual([])
  })

  it('NullCalendar_IsAlwaysUnavailable_NeverProposes', async () => {
    const plan = await planImport(new NullCalendar(), [], range, true)
    expect(plan.status).toBe('unavailable')
    expect(plan.proposal).toEqual({ changes: [], orphaned: [], unchangedCount: 0 })
  })
})

describe('NullCalendar', () => {
  it('AvailableIsFalse_AndFetchRejects', async () => {
    const cal = new NullCalendar()
    expect(await cal.available()).toBe(false)
    await expect(cal.fetchEvents(range)).rejects.toBeInstanceOf(CalendarUnavailableError)
  })
})
