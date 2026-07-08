import { describe, expect, it } from 'vitest'
import { buildTimesheet, type TimesheetEntryInput } from './timesheet.js'
import { NO_ROUNDING } from '../tracking/rounding.js'
import { HOUR_MS, MINUTE_MS } from '../tracking/time.js'

/**
 * The deterministic timesheet builder (REQ-009) — the single source every export
 * format serializes, so their totals are provably equal.
 */
const entry = (over: Partial<TimesheetEntryInput> = {}): TimesheetEntryInput => ({
  durationMs: over.durationMs ?? HOUR_MS,
  rateMinorPerHour: over.rateMinorPerHour ?? 6000,
  billable: over.billable ?? true,
  groupKey: over.groupKey ?? 'g1',
  groupLabel: over.groupLabel ?? 'Group 1',
  ...(over.note !== undefined ? { note: over.note } : {}),
})

describe('buildTimesheet', () => {
  it('BuildTimesheet_GroupsBySameKey_SumsDurationAndAmount', () => {
    const ts = buildTimesheet(
      [
        entry({ durationMs: HOUR_MS, groupKey: 'p1', groupLabel: 'Project 1' }),
        entry({ durationMs: 30 * MINUTE_MS, groupKey: 'p1', groupLabel: 'Project 1' }),
      ],
      { rounding: NO_ROUNDING, currency: 'EUR' },
    )
    expect(ts.lines).toHaveLength(1)
    expect(ts.lines[0]?.durationMs).toBe(90 * MINUTE_MS)
    expect(ts.lines[0]?.amountMinor).toBe(9000) // 6000 + 3000
    expect(ts.totalDurationMs).toBe(90 * MINUTE_MS)
    expect(ts.totalAmountMinor).toBe(9000)
  })

  it('BuildTimesheet_EntryLevel_CarriesNoteAsPositionText', () => {
    const ts = buildTimesheet(
      [
        entry({ groupKey: 'e2', groupLabel: 'Dev', note: 'wrote the parser' }),
        entry({ groupKey: 'e1', groupLabel: 'Design', note: 'mockups' }),
      ],
      { rounding: NO_ROUNDING, currency: 'EUR' },
    )
    // Sorted by key → e1, e2 (byte-stable order).
    expect(ts.lines.map(l => l.key)).toEqual(['e1', 'e2'])
    expect(ts.lines[0]?.note).toBe('mockups')
    expect(ts.lines[1]?.note).toBe('wrote the parser')
  })

  it('BuildTimesheet_MultiEntryLine_DropsNote', () => {
    const ts = buildTimesheet(
      [entry({ groupKey: 'p1', note: 'a' }), entry({ groupKey: 'p1', note: 'b' })],
      { rounding: NO_ROUNDING, currency: 'EUR' },
    )
    expect(ts.lines[0]?.note).toBeUndefined()
  })

  it('BuildTimesheet_RoundingProfile_AppliedPerEntryBeforeCost', () => {
    // 50 min at 120.00/h, rounded to nearest 15 min → 45 min → 90.00.
    const ts = buildTimesheet([entry({ durationMs: 50 * MINUTE_MS, rateMinorPerHour: 12000 })], {
      rounding: { mode: 'nearest', incrementMinutes: 15 },
      currency: 'EUR',
    })
    expect(ts.lines[0]?.durationMs).toBe(45 * MINUTE_MS)
    expect(ts.lines[0]?.amountMinor).toBe(9000)
  })

  it('BuildTimesheet_BillableOnly_ExcludesNonBillable', () => {
    const ts = buildTimesheet(
      [
        entry({ groupKey: 'p1', billable: true }),
        entry({ groupKey: 'p2', groupLabel: 'Internal', billable: false }),
      ],
      { rounding: NO_ROUNDING, currency: 'EUR', billableOnly: true },
    )
    expect(ts.lines).toHaveLength(1)
    expect(ts.lines[0]?.key).toBe('p1')
    expect(ts.billableOnly).toBe(true)
  })

  it('BuildTimesheet_EchoesCurrencyAndRoundingForAudit', () => {
    const rounding = { mode: 'up', incrementMinutes: 6 } as const
    const ts = buildTimesheet([entry()], { rounding, currency: 'CHF' })
    expect(ts.currency).toBe('CHF')
    expect(ts.rounding).toEqual(rounding)
  })

  it('BuildTimesheet_NoEntries_IsEmptyWithZeroTotals', () => {
    const ts = buildTimesheet([], { rounding: NO_ROUNDING, currency: 'EUR' })
    expect(ts.lines).toEqual([])
    expect(ts.totalDurationMs).toBe(0)
    expect(ts.totalAmountMinor).toBe(0)
  })

  it('BuildTimesheet_TotalsEqualSumOfLines', () => {
    const ts = buildTimesheet(
      [
        entry({ durationMs: HOUR_MS, rateMinorPerHour: 5000, groupKey: 'a', groupLabel: 'A' }),
        entry({ durationMs: 2 * HOUR_MS, rateMinorPerHour: 7000, groupKey: 'b', groupLabel: 'B' }),
      ],
      { rounding: NO_ROUNDING, currency: 'EUR' },
    )
    const lineSum = ts.lines.reduce((s, l) => s + l.amountMinor, 0)
    expect(ts.totalAmountMinor).toBe(lineSum)
    expect(ts.totalAmountMinor).toBe(5000 + 14000)
  })
})
