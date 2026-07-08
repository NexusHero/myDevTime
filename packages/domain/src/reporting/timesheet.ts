import type { DurationMs } from '../tracking/time.js'
import { roundDuration, type RoundingRule } from '../tracking/rounding.js'
import { costOf, sumMoney, type Money } from '../budgets/money.js'

/**
 * The deterministic timesheet builder (REQ-009, ADR-0005) — the single place
 * every exported number is computed, so CSV, XLSX and PDF all serialize the same
 * pure result (their totals are provably equal because they share this).
 *
 * Pricing unit is the **entry**: each entry's duration is rounded by the report's
 * rounding profile, then priced at the rate the caller already resolved for it
 * (rate effective-dating lives in `budgets/rates`). Lines are groups of entries;
 * a line's numbers are the sum of its entries'. The rounding profile is echoed
 * into the result for auditability.
 */

export type TimesheetGroupBy = 'entry' | 'day' | 'project' | 'task'

export interface TimesheetEntryInput {
  /** Exact tracked duration (before rounding). */
  readonly durationMs: DurationMs
  /** Rate in integer minor units per hour, already resolved for this entry. */
  readonly rateMinorPerHour: Money
  readonly billable: boolean
  /** The group this entry belongs to for the chosen grouping. */
  readonly groupKey: string
  readonly groupLabel: string
  /** Position text (entry note, #46) — surfaced on entry-level lines. */
  readonly note?: string
}

export interface TimesheetOptions {
  readonly rounding: RoundingRule
  readonly currency: string
  /** Exclude non-billable entries from the document. */
  readonly billableOnly?: boolean
}

export interface TimesheetLine {
  readonly key: string
  readonly label: string
  /** Rounded, summed duration for the line. */
  readonly durationMs: DurationMs
  readonly amountMinor: Money
  /** Present only when the line is a single entry (its position text). */
  readonly note?: string
}

export interface Timesheet {
  readonly lines: readonly TimesheetLine[]
  readonly totalDurationMs: DurationMs
  readonly totalAmountMinor: Money
  readonly currency: string
  /** The rounding profile applied — embedded for audit. */
  readonly rounding: RoundingRule
  readonly billableOnly: boolean
}

interface Accumulator {
  label: string
  durationMs: DurationMs
  amounts: Money[]
  entryCount: number
  firstNote: string | undefined
}

/**
 * Build a timesheet from priced entries. Each entry is rounded then costed; the
 * lines are the entries grouped by `groupKey`, in key order (stable, so exports
 * are byte-reproducible).
 */
export function buildTimesheet(
  entries: readonly TimesheetEntryInput[],
  options: TimesheetOptions,
): Timesheet {
  const billableOnly = options.billableOnly ?? false
  const groups = new Map<string, Accumulator>()

  for (const entry of entries) {
    if (billableOnly && !entry.billable) continue
    const rounded = roundDuration(entry.durationMs, options.rounding)
    const amount = costOf(entry.rateMinorPerHour, rounded)
    const acc = groups.get(entry.groupKey)
    if (acc) {
      acc.durationMs += rounded
      acc.amounts.push(amount)
      acc.entryCount += 1
    } else {
      groups.set(entry.groupKey, {
        label: entry.groupLabel,
        durationMs: rounded,
        amounts: [amount],
        entryCount: 1,
        firstNote: entry.note,
      })
    }
  }

  const lines: TimesheetLine[] = [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, acc]) => {
      const line: TimesheetLine = {
        key,
        label: acc.label,
        durationMs: acc.durationMs,
        amountMinor: sumMoney(acc.amounts),
      }
      // Carry the position text only when the line is exactly one entry.
      return acc.entryCount === 1 && acc.firstNote !== undefined
        ? { ...line, note: acc.firstNote }
        : line
    })

  return {
    lines,
    totalDurationMs: lines.reduce((sum, l) => sum + l.durationMs, 0),
    totalAmountMinor: sumMoney(lines.map(l => l.amountMinor)),
    currency: options.currency,
    rounding: options.rounding,
    billableOnly,
  }
}
