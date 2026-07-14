import { costOf, sumMoney, type Money } from '../budgets/money.js'
import { rateForEntry, type ScopedRateRule } from '../budgets/pricing.js'
import { entryDuration, type TimeEntry } from '../tracking/time-entry.js'
import type { DurationMs, Instant } from '../tracking/time.js'

/**
 * Invoicing / "Abrechnung" (design v6, REQ-005/009, ADR-0005) — the deterministic
 * core of the freelancer billing flow. Given a client's tracked entries and the
 * effective-dated rates, it produces the concrete **invoice lines** (one per
 * billable entry) and rolls a chosen selection up into a draft total. The money
 * is the same integer-minor-unit math (`rateForEntry` → `costOf`) the Reports
 * `billing` figures already use, so an invoice and the dashboard never disagree.
 *
 * Pure and vendor-free: the server service supplies the entries, the client→
 * project map, the rates and the window; persistence (marking entries invoiced)
 * is a storage concern layered on top. LLMs never touch these numbers.
 */

/** One priced position on an invoice — a single billable time entry. */
export interface InvoiceLine {
  readonly entryId: string
  readonly projectId: string
  readonly taskId: string | null
  readonly start: Instant
  readonly durationMs: DurationMs
  /** Priced amount in integer minor units; `0` when the entry is unpriced. */
  readonly amountMinor: Money
  /** False when no rate is in effect for the entry's chain at its start. */
  readonly priced: boolean
  readonly note: string | null
}

/** The selectable, rolled-up draft the invoicing drawer shows and issues. */
export interface InvoiceDraft {
  readonly lines: readonly InvoiceLine[]
  readonly totalDurationMs: DurationMs
  readonly totalMinor: Money
}

/** Half-open billing window `[from, to)` in absolute instants. */
export interface InvoiceWindow {
  readonly from: Instant
  readonly to: Instant
}

/**
 * The billable positions for one client's work in a window: every **completed**,
 * **billable**, project-assigned entry whose start falls in `[from, to)`, priced
 * with the rate in effect at its start. Unpriced entries are kept (amount `0`,
 * `priced: false`) so the user sees the work and can add a missing rate rather
 * than silently losing hours. Sorted by start, then id, for a stable statement.
 *
 * The caller pre-filters to a single client and to not-yet-invoiced entries
 * (a storage concern); this stays pure and re-runnable.
 */
export function invoiceLines(
  entries: readonly TimeEntry[],
  clientByProject: ReadonlyMap<string, string | null>,
  rates: readonly ScopedRateRule[],
  window: InvoiceWindow,
): readonly InvoiceLine[] {
  const lines: InvoiceLine[] = []
  for (const e of entries) {
    if (!e.billable || e.projectId === undefined || e.end === null) continue
    if (e.start < window.from || e.start >= window.to) continue
    const rate = rateForEntry(
      rates,
      {
        projectId: e.projectId,
        clientId: clientByProject.get(e.projectId) ?? null,
        taskId: e.taskId ?? null,
      },
      e.start,
    )
    const durationMs = entryDuration(e)
    lines.push({
      entryId: e.id,
      projectId: e.projectId,
      taskId: e.taskId ?? null,
      start: e.start,
      durationMs,
      amountMinor: rate === null ? 0 : costOf(rate, durationMs),
      priced: rate !== null,
      note: e.note ?? null,
    })
  }
  return lines.sort((a, b) => a.start - b.start || a.entryId.localeCompare(b.entryId))
}

/**
 * Roll the chosen lines up into a draft total. Only lines whose `entryId` is in
 * `selectedIds` count — the drawer lets the user deselect positions (non-billable
 * work is deselected up front). Sum stays integer minor units.
 */
export function summarizeInvoice(
  lines: readonly InvoiceLine[],
  selectedIds: ReadonlySet<string>,
): InvoiceDraft {
  const selected = lines.filter(l => selectedIds.has(l.entryId))
  return {
    lines: selected,
    totalDurationMs: selected.reduce((sum, l) => sum + l.durationMs, 0),
    totalMinor: sumMoney(selected.map(l => l.amountMinor)),
  }
}
