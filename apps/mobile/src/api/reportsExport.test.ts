import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './http.js'
import { fetchReportsPdf, toReportExportInput } from './reportsExport.js'
import type { ReportsData } from '../hooks/useReports'

/**
 * The client seam for the server-rendered Reports PDF (REQ-045). We pin that the mapping carries
 * every field of the live `ReportsData` onto the deterministic view-model (so the export can never
 * silently drop a section), that the POST hits the export route and returns the server's bytes, and
 * that a failure surfaces as an `ApiError` (honest error state — never a broken download).
 */
const data: ReportsData = {
  totalMs: 9_000_000,
  billableMs: 7_200_000,
  billableMinor: 12_345,
  currencyCode: 'EUR',
  overtimeMs: -1_800_000,
  byProject: [{ id: 'p1', name: 'Finanzo', spentMs: 5_400_000, daily: [] }],
  budgets: [
    { id: 'b1', name: 'Q3', ratio: 0.732, consumed: 50_000, basis: 'fee', currencyCode: 'EUR' },
  ],
}

function fakeResponse(init: {
  ok: boolean
  status: number
  blob?: Blob
  json?: unknown
}): Response {
  return {
    ok: init.ok,
    status: init.status,
    blob: () => Promise.resolve(init.blob ?? new Blob()),
    json: () =>
      init.json === undefined ? Promise.reject(new Error('no json')) : Promise.resolve(init.json),
  } as unknown as Response
}

describe('toReportExportInput', () => {
  it('MapsEveryFieldOfTheLiveReportsData', () => {
    const input = toReportExportInput('week', data)

    expect(input).toEqual({
      range: 'week',
      totalMs: 9_000_000,
      billableMs: 7_200_000,
      billableMinor: 12_345,
      currencyCode: 'EUR',
      overtimeMs: -1_800_000,
      projects: [{ name: 'Finanzo', trackedMs: 5_400_000 }],
      budgets: [{ name: 'Q3', consumedMinor: 50_000, ratio: 0.732, currencyCode: 'EUR' }],
    })
  })
})

describe('fetchReportsPdf', () => {
  it('PostsTheViewModelToTheExportRoute_AndReturnsTheBytes', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    let seenUrl = ''
    let seenInit: RequestInit | undefined
    const fetchImpl = ((url: string, init?: RequestInit) => {
      seenUrl = url
      seenInit = init
      return Promise.resolve(fakeResponse({ ok: true, status: 200, blob }))
    }) as unknown as typeof fetch

    const out = await fetchReportsPdf('https://api.test', 'week', data, fetchImpl)

    expect(out).toBe(blob)
    expect(seenUrl).toBe('https://api.test/api/tracking/reports/export?format=pdf')
    expect(seenInit?.method).toBe('POST')
    const body = typeof seenInit?.body === 'string' ? seenInit.body : ''
    expect(JSON.parse(body)).toMatchObject({ range: 'week', totalMs: 9_000_000 })
  })

  it('NonOkResponse_ThrowsApiErrorFromProblemJson', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        fakeResponse({
          ok: false,
          status: 401,
          json: { title: 'Unauthorized', detail: 'no session' },
        }),
      ),
    )

    await expect(
      fetchReportsPdf('https://api.test', 'week', data, fetchImpl as typeof fetch),
    ).rejects.toMatchObject({ name: 'ApiError', status: 401, title: 'Unauthorized' })
  })

  it('NetworkFailure_ThrowsApiError', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('offline')))

    const err = await fetchReportsPdf(
      'https://api.test',
      'week',
      data,
      fetchImpl as typeof fetch,
    ).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(0)
  })
})
