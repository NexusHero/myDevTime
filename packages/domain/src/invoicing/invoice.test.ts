import { describe, expect, it } from 'vitest'
import { invoiceLines, summarizeInvoice, type InvoiceWindow } from './invoice.js'
import { hoursToMs } from '../budgets/money.js'
import type { ScopedRateRule } from '../budgets/pricing.js'
import type { TimeEntry } from '../tracking/time-entry.js'

const H = (n: number): number => hoursToMs(n)
const T0 = 1_700_000_000_000 // arbitrary fixed instant
const WINDOW: InvoiceWindow = { from: T0, to: T0 + H(24 * 30) }

const CLIENT_BY_PROJECT = new Map<string, string | null>([
  ['p1', 'c1'],
  ['p2', 'c1'],
  ['pInternal', null],
])

// 100 €/h at project p1, in minor units (cents) per hour.
const RATES: readonly ScopedRateRule[] = [
  { level: 'project', scopeId: 'p1', amountMinorPerHour: 10_000, effectiveFrom: T0 - H(1000) },
]

function entry(over: Partial<TimeEntry> & Pick<TimeEntry, 'id' | 'start'>): TimeEntry {
  return {
    end: over.start + H(2),
    billable: true,
    source: 'manual',
    projectId: 'p1',
    ...over,
  }
}

describe('invoiceLines', () => {
  it('invoiceLines_billableCompletedInWindow_pricesAndSortsByStart', () => {
    const entries: TimeEntry[] = [
      entry({ id: 'b', start: T0 + H(48), end: T0 + H(49) }), // 1h → 10000
      entry({ id: 'a', start: T0 + H(2), end: T0 + H(4) }), // 2h → 20000
    ]
    const lines = invoiceLines(entries, CLIENT_BY_PROJECT, RATES, WINDOW)
    expect(lines.map(l => l.entryId)).toEqual(['a', 'b']) // sorted by start
    expect(lines[0]).toMatchObject({ durationMs: H(2), amountMinor: 20_000, priced: true })
    expect(lines[1]).toMatchObject({ durationMs: H(1), amountMinor: 10_000, priced: true })
  })

  it('invoiceLines_skipsNonBillableRunningUnassignedAndOutOfWindow', () => {
    const unassigned: TimeEntry = {
      id: 'unassigned',
      start: T0 + H(1),
      end: T0 + H(2),
      billable: true,
      source: 'manual',
    }
    const entries: TimeEntry[] = [
      entry({ id: 'nonbillable', start: T0 + H(1), billable: false }),
      entry({ id: 'running', start: T0 + H(1), end: null }),
      unassigned,
      entry({ id: 'before', start: T0 - H(1), end: T0 }),
      entry({ id: 'after', start: WINDOW.to, end: WINDOW.to + H(1) }),
      entry({ id: 'keep', start: T0 + H(3) }),
    ]
    const lines = invoiceLines(entries, CLIENT_BY_PROJECT, RATES, WINDOW)
    expect(lines.map(l => l.entryId)).toEqual(['keep'])
  })

  it('invoiceLines_noRateInEffect_listsUnpricedAtZero', () => {
    const entries: TimeEntry[] = [entry({ id: 'x', start: T0 + H(2), projectId: 'p2' })]
    const lines = invoiceLines(entries, CLIENT_BY_PROJECT, RATES, WINDOW)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ entryId: 'x', amountMinor: 0, priced: false })
  })

  it('invoiceLines_projectMissingFromClientMap_treatedAsNoClient', () => {
    // p1 has a project-level rate, so it prices even with no client mapping entry.
    const entries: TimeEntry[] = [entry({ id: 'x', start: T0 + H(2), projectId: 'p1' })]
    const [line] = invoiceLines(entries, new Map(), RATES, WINDOW)
    expect(line).toMatchObject({ entryId: 'x', priced: true, amountMinor: 20_000 })
  })

  it('invoiceLines_carriesTaskAndNote', () => {
    const entries: TimeEntry[] = [
      entry({ id: 'x', start: T0 + H(2), taskId: 't9', note: 'Checkout flow' }),
    ]
    const [line] = invoiceLines(entries, CLIENT_BY_PROJECT, RATES, WINDOW)
    expect(line).toMatchObject({ taskId: 't9', note: 'Checkout flow' })
  })
})

describe('summarizeInvoice', () => {
  const entries: TimeEntry[] = [
    entry({ id: 'a', start: T0 + H(2), end: T0 + H(4) }), // 2h → 20000
    entry({ id: 'b', start: T0 + H(5), end: T0 + H(6) }), // 1h → 10000
    entry({ id: 'c', start: T0 + H(7), end: T0 + H(8), billable: true, projectId: 'p2' }), // unpriced
  ]
  const lines = invoiceLines(entries, CLIENT_BY_PROJECT, RATES, WINDOW)

  it('summarizeInvoice_selectedOnly_sumsHoursAndMoney', () => {
    const draft = summarizeInvoice(lines, new Set(['a', 'b']))
    expect(draft.lines.map(l => l.entryId)).toEqual(['a', 'b'])
    expect(draft.totalDurationMs).toBe(H(3))
    expect(draft.totalMinor).toBe(30_000)
  })

  it('summarizeInvoice_deselectingUnpriced_leavesMoneyUnchanged', () => {
    const draft = summarizeInvoice(lines, new Set(['a', 'c']))
    expect(draft.totalMinor).toBe(20_000) // c is unpriced (0)
    expect(draft.totalDurationMs).toBe(H(3))
  })

  it('summarizeInvoice_emptySelection_isZero', () => {
    const draft = summarizeInvoice(lines, new Set())
    expect(draft.lines).toEqual([])
    expect(draft.totalDurationMs).toBe(0)
    expect(draft.totalMinor).toBe(0)
  })
})
