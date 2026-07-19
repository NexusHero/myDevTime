// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import { Button } from '../index.js'
import type { ExportRunItem } from '../../api/export.js'

/**
 * Render tests (ADR-0027) for the dev-tool export card (REQ-035, #44). The export api is mocked so
 * the test pins the CLIENT contract of ADR-0035/0005: the existing ledger renders; running against
 * a target that comes back `unavailable` shows the honest "not configured in this deployment" state
 * and NEVER a fake success; a `sent` outcome surfaces the created item's external id/url so the post
 * is auditable. The card only ever claims what the backend actually reported.
 */
const { fetchExportRecords, runExport } = vi.hoisted(() => ({
  fetchExportRecords: vi.fn(),
  runExport: vi.fn(),
}))
vi.mock('../../api/export.js', () => ({ fetchExportRecords, runExport }))

const { DevToolExportCard } = await import('./DevToolExportCard.js')

const ITEMS: readonly ExportRunItem[] = [
  { dedupeKey: 'meeting:1:action:0', label: 'Ship the export card' },
]

function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}
function tree(r: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(r.toJSON())
}
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}
function button(r: TestRenderer.ReactTestRenderer, label: string): TestRenderer.ReactTestInstance {
  const b = r.root.findAllByType(Button).find(x => x.props.children === label)
  expect(b, label).toBeDefined()
  return b!
}
async function press(b: TestRenderer.ReactTestInstance): Promise<void> {
  await act(async () => {
    ;(b.props.onPress as () => void)()
  })
  await flush()
}

describe('DevToolExportCard', () => {
  it('RendersTheExistingLedger_FromFetchRecords', async () => {
    fetchExportRecords.mockResolvedValueOnce([
      {
        id: 'r1',
        target: 'jira',
        dedupeKey: 'meeting:0:action:0',
        status: 'sent',
        externalId: 'JIRA-1',
        url: 'https://jira.example/browse/JIRA-1',
        itemLabel: 'A previously exported item',
        createdAt: '2026-07-19T10:00:00.000Z',
      },
    ])
    runExport.mockResolvedValue({ target: 'jira', sentCount: 0, records: [] })
    const r = render(<DevToolExportCard baseUrl="https://api.test" items={ITEMS} />)
    await flush()

    const out = tree(r)
    expect(fetchExportRecords).toHaveBeenCalledTimes(1)
    expect(out).toContain('A previously exported item')
    expect(out).toContain('https://jira.example/browse/JIRA-1')
  })

  it('UnavailableTarget_ShowsHonestNotConfigured_AndNoFakeSuccess', async () => {
    fetchExportRecords.mockResolvedValue([])
    runExport.mockResolvedValueOnce({
      target: 'jira',
      sentCount: 0,
      records: [{ dedupeKey: 'meeting:1:action:0', outcome: 'unavailable' }],
    })
    const r = render(<DevToolExportCard baseUrl="https://api.test" items={ITEMS} />)
    await flush()

    await press(button(r, 'Export 1 item'))

    expect(runExport).toHaveBeenCalledTimes(1)
    expect(runExport.mock.calls[0]?.[1]).toEqual({
      target: 'jira',
      items: [{ dedupeKey: 'meeting:1:action:0', label: 'Ship the export card' }],
    })
    const out = tree(r)
    expect(out).toContain('not configured in this deployment')
    // Honesty (ADR-0005): an unavailable target is never dressed up as a successful post.
    expect(out).not.toContain('Sent')
    expect(out).not.toContain('1 item sent')
  })

  it('SentOutcome_RendersTheExternalIdAndLink', async () => {
    fetchExportRecords.mockResolvedValue([])
    runExport.mockResolvedValueOnce({
      target: 'jira',
      sentCount: 1,
      records: [
        {
          dedupeKey: 'meeting:1:action:0',
          outcome: 'sent',
          result: {
            ok: true,
            externalId: 'JIRA-42',
            url: 'https://jira.example/browse/JIRA-42',
          },
        },
      ],
    })
    const r = render(<DevToolExportCard baseUrl="https://api.test" items={ITEMS} />)
    await flush()

    await press(button(r, 'Export 1 item'))

    const out = tree(r)
    expect(out).toContain('Sent')
    expect(out).toContain('JIRA-42')
    expect(out).toContain('https://jira.example/browse/JIRA-42')
  })
})
