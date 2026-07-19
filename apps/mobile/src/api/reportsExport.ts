import { Platform } from 'react-native'
import type { ReportExportInput } from '@mydevtime/domain'
import type { ReportsData } from '../hooks/useReports'
import { ApiError, problemToError } from './http.js'

/**
 * Client seam for the server-rendered Reports/analytics export (REQ-045). The CSV rendition is
 * produced locally by the deterministic core (`reports/exportCsv`); the **PDF** rendition needs the
 * PDFKit infra that lives on the server (ADR-0020), so this maps the live `ReportsData` onto the
 * deterministic view-model, posts it to `POST /api/tracking/reports/export?format=pdf`, and hands the
 * bytes to a browser download. The server only *formats* — every figure is still the deterministic
 * core's (ADR-0005). On native (no DOM) the download is unavailable — the caller degrades honestly
 * rather than pretending a file was saved. `fetchImpl` is injectable so it runs without a network.
 */
export function toReportExportInput(range: string, data: ReportsData): ReportExportInput {
  return {
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
}

/**
 * Post the Reports view-model and read back the rendered PDF as a `Blob`. Throws `ApiError` on a
 * network failure or a non-2xx (mapped from the server's problem+json), so the caller can surface an
 * honest error instead of a broken download.
 */
export async function fetchReportsPdf(
  baseUrl: string,
  range: string,
  data: ReportsData,
  fetchImpl: typeof fetch = fetch,
): Promise<Blob> {
  const input = toReportExportInput(range, data)
  let res: Response
  try {
    res = await fetchImpl(`${baseUrl}/api/tracking/reports/export?format=pdf`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', accept: 'application/pdf' },
      body: JSON.stringify(input),
    })
  } catch (cause) {
    throw new ApiError(0, 'Network error', cause instanceof Error ? cause.message : undefined)
  }
  if (!res.ok) {
    let problem: unknown = null
    try {
      problem = await res.json()
    } catch {
      // Non-JSON error body — fall through to a bare status error.
    }
    throw problemToError(res.status, problem)
  }
  return res.blob()
}

/**
 * Download the Reports view as a PDF for the given window. Returns `true` when the download was
 * started (web), `false` where it is unavailable (native — no DOM), so the caller can tell the user
 * honestly instead of silently doing nothing. Rejects (with `ApiError`) when the server call fails.
 */
export async function downloadReportsPdf(
  baseUrl: string,
  range: string,
  data: ReportsData,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false
  const blob = await fetchReportsPdf(baseUrl, range, data, fetchImpl)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mydevtime-reports-${range}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
