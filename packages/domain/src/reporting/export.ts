/**
 * Deterministic Reports export (REQ-045, ADR-0005). The Reports dashboard is a read-only view over
 * figures the reporting core already computed; this module turns that view-model into a **CSV
 * document** — a set of labelled sections (summary, per-project tracked time, budgets) — with every
 * number formatted here, never in the UI. It is distinct from the timesheet/invoice export (REQ-009,
 * `reporting/timesheet`): that exports billable line items for signing, this exports the analytics
 * dashboard. Pure and side-effect-free: same input → byte-identical CSV, so it is exhaustively
 * testable and the client only has to hand the bytes to a download. No fabricated figures — an empty
 * report exports its headers with no data rows.
 */

/** One project's tracked time in the window (name + milliseconds), already computed upstream. */
export interface ReportExportProject {
  readonly name: string
  readonly trackedMs: number
}

/** One budget's consumption in the window: consumed minor units, utilization ratio, its currency. */
export interface ReportExportBudget {
  readonly name: string
  readonly consumedMinor: number
  readonly ratio: number
  readonly currencyCode: string
}

/** The neutral Reports view-model to export — the client maps its `ReportsData` onto this. */
export interface ReportExportInput {
  /** The window label, e.g. `week` / `month` / `year`. */
  readonly range: string
  readonly totalMs: number
  readonly billableMs: number
  readonly billableMinor: number
  readonly currencyCode: string
  /** Signed overtime balance (net worked − target) over the window. */
  readonly overtimeMs: number
  readonly projects: readonly ReportExportProject[]
  readonly budgets: readonly ReportExportBudget[]
}

const MS_PER_HOUR = 3_600_000

/** Milliseconds → hours with two decimals (deterministic; no locale, no `Intl`). */
function hours(ms: number): string {
  return (ms / MS_PER_HOUR).toFixed(2)
}

/** Minor currency units → a plain decimal amount with two places (deterministic). */
function amount(minor: number): string {
  return (minor / 100).toFixed(2)
}

/** A ratio (0–1+) → an integer percent (deterministic rounding). */
function percent(ratio: number): string {
  return `${String(Math.round(ratio * 100))}%`
}

/**
 * RFC 4180 CSV cell: wrap in quotes and double any embedded quote when the value carries a comma,
 * quote, CR or LF — so a project named `Acme, Inc.` never splits a column.
 */
function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Join one CSV row from already-stringified cells. */
function row(cells: readonly string[]): string {
  return cells.map(cell).join(',')
}

/**
 * Build the Reports CSV: a summary block, a per-project tracked-time block, and a budgets block,
 * separated by blank lines. Rows keep the input order (already deterministic). Every figure is
 * formatted here (hours to 2dp, money to 2dp, utilization as an integer percent).
 */
export function reportToCsv(input: ReportExportInput): string {
  const lines: string[] = []

  lines.push(row(['Report', 'Range']))
  lines.push(row(['myDevTime analytics', input.range]))
  lines.push('')

  lines.push(row(['Metric', 'Value']))
  lines.push(row(['Total tracked (h)', hours(input.totalMs)]))
  lines.push(row(['Billable tracked (h)', hours(input.billableMs)]))
  lines.push(row([`Billable (${input.currencyCode})`, amount(input.billableMinor)]))
  lines.push(row(['Overtime balance (h)', hours(input.overtimeMs)]))
  lines.push('')

  lines.push(row(['Project', 'Tracked (h)']))
  for (const p of input.projects) {
    lines.push(row([p.name, hours(p.trackedMs)]))
  }
  lines.push('')

  lines.push(row(['Budget', 'Consumed', 'Currency', 'Utilization']))
  for (const b of input.budgets) {
    lines.push(row([b.name, amount(b.consumedMinor), b.currencyCode, percent(b.ratio)]))
  }

  return lines.join('\n')
}
