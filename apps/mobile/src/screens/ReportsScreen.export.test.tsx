// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { ToastProvider } from '../components/core/Toast.js'
import { Button } from '../components/index.js'

/**
 * The Reports export controls (REQ-045). The dashboard renders only deterministic figures, so every
 * data hook is injected through its seam. This pins the CLIENT contract of the export affordances:
 * both the CSV control (rendered locally by the deterministic core) and the PDF control (posts the
 * view-model to the server PDFKit route) render; the PDF export is a live control, and pressing it
 * calls the server seam with the current window and data — never a fabricated export.
 */
vi.mock('../hooks/useReports', () => ({
  useReports: () => ({
    data: {
      totalMs: 5_400_000,
      billableMs: 3_600_000,
      billableMinor: 12_345,
      currencyCode: 'EUR',
      byProject: [{ id: 'p1', name: 'Website', spentMs: 3_600_000, daily: [] }],
      budgets: [],
      overtimeMs: 0,
    },
    loading: false,
    error: null,
    reload: () => undefined,
    live: true,
  }),
}))
vi.mock('../hooks/useRevenueBudget', () => ({
  useRevenueBudget: () => ({ data: null, loading: false, error: null, reload: () => undefined }),
}))
vi.mock('../hooks/useOvertimeTrend', () => ({
  useOvertimeTrend: () => ({ data: null, loading: false, error: null, reload: () => undefined }),
}))
vi.mock('../hooks/useBalance', () => ({
  useBalance: () => ({ data: null, loading: false, error: null, reload: () => undefined }),
}))
vi.mock('../hooks/useCheckin', () => ({
  useCheckin: () => ({ done: false, submit: () => undefined }),
}))
vi.mock('../hooks/useTrackingHeatmap', () => ({
  useTrackingHeatmap: () => ({ data: null, loading: false, error: null, reload: () => undefined }),
}))
vi.mock('../hooks/useBudgetBurndown', () => ({
  useBudgetBurndown: () => ({
    data: null,
    projection: null,
    loading: false,
    error: null,
    reload: () => undefined,
  }),
}))
vi.mock('../api/standup', () => ({ generateStandup: vi.fn() }))
vi.mock('../config', () => ({ apiBaseUrl: 'https://api.test' }))

const { downloadReportsPdf } = vi.hoisted(() => ({
  downloadReportsPdf: vi.fn(() => Promise.resolve(true)),
}))
vi.mock('../api/reportsExport', () => ({ downloadReportsPdf }))

const { ReportsScreen } = await import('./ReportsScreen.js')

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer
  await act(async () => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          <ReportsScreen />
        </ToastProvider>
      </ThemeProvider>,
    )
  })
  return renderer
}

describe('ReportsScreen export', () => {
  it('RendersBothTheCsvAndPdfExportControls', async () => {
    const renderer = await render()

    const labels = renderer.root.findAllByType(Button).map(b => b.props.children)
    expect(labels).toContain('Export CSV')
    expect(labels).toContain('Export PDF')
  })

  it('PressExportPdf_CallsTheServerSeamWithTheWindowAndData', async () => {
    const renderer = await render()
    const pdf = renderer.root.findAllByType(Button).find(b => b.props.children === 'Export PDF')
    expect(pdf).toBeDefined()

    await act(async () => {
      ;(pdf!.props.onPress as () => void)()
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(downloadReportsPdf).toHaveBeenCalledTimes(1)
    const call = downloadReportsPdf.mock.calls[0] as unknown as [
      string,
      string,
      { totalMs: number },
    ]
    expect(call[1]).toBe('week')
    expect(call[2]).toMatchObject({ totalMs: 5_400_000, billableMinor: 12_345 })
  })
})
