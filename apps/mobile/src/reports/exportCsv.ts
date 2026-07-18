import { Platform } from 'react-native'
import { reportToCsv, type ReportExportInput } from '@mydevtime/domain'
import type { ReportsData } from '../hooks/useReports'

/**
 * Client seam for the Reports/analytics export (REQ-045). Every figure and every byte of the CSV is
 * produced by the deterministic `reportToCsv` core (ADR-0005); this only maps the live `ReportsData`
 * onto the core's neutral input and hands the bytes to a browser download. On native (no DOM) the
 * download is unavailable — the caller degrades honestly rather than pretending.
 */
export function reportsToCsv(range: string, data: ReportsData): string {
  const input: ReportExportInput = {
    range,
    totalMs: data.totalMs,
    billableMs: data.billableMs,
    billableMinor: data.billableMinor,
    currencyCode: data.currencyCode,
    overtimeMs: data.overtimeMs,
    projects: data.byProject.map(p => ({ name: p.name, trackedMs: p.spentMs })),
    budgets: data.budgets.map(b => ({
      name: b.name,
      consumedMinor: b.consumed,
      ratio: b.ratio,
      currencyCode: b.currencyCode,
    })),
  }
  return reportToCsv(input)
}

/**
 * Trigger a CSV download of the Reports view for the given window. Returns `true` when the download
 * was started (web), `false` where it is unavailable (native — no DOM), so the caller can tell the
 * user honestly instead of silently doing nothing.
 */
export function downloadReportsCsv(range: string, data: ReportsData): boolean {
  const csv = reportsToCsv(range, data)
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mydevtime-reports-${range}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
