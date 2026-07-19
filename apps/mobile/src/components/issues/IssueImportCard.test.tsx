// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import { ToastProvider } from '../core/Toast.js'
import { Button } from '../index.js'
import type { IssueImportPreview } from '../../api/issues.js'

/**
 * Render tests (ADR-0027) for the issue/ticket import card. The issues api and the task-create
 * client are mocked so the test pins the CLIENT contract of ADR-0005: previewed issues render as
 * **proposals** (nothing imported yet); a `no-consent` status shows the honest reason and imports
 * NOTHING; selecting proposals and hitting Import creates exactly one task per selected proposal
 * via the existing task-create client — never a fake or auto import.
 */
const { previewIssueImport, recordImported, createTask } = vi.hoisted(() => ({
  previewIssueImport: vi.fn(),
  recordImported: vi.fn(),
  createTask: vi.fn(),
}))
vi.mock('../../api/issues.js', () => ({ previewIssueImport, recordImported }))
vi.mock('../../api/tracking.js', () => ({ createTask }))

const { IssueImportCard } = await import('./IssueImportCard.js')

const PROJECTS = [{ id: 'p1', name: 'Website' }]

const OK_PREVIEW: IssueImportPreview = {
  status: 'ok',
  proposals: [
    {
      externalKey: 'gh#1',
      source: 'github',
      title: 'Fix the login bug',
      provenance: 'import:github',
      confirmed: false,
      labels: ['bug'],
      url: 'https://github.com/acme/app/issues/1',
    },
    {
      externalKey: 'gh#2',
      source: 'github',
      title: 'Add dark mode',
      provenance: 'import:github',
      confirmed: false,
      labels: [],
      url: 'https://github.com/acme/app/issues/2',
    },
  ],
}

function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <ToastProvider>{node}</ToastProvider>
      </ThemeProvider>,
    )
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
function button(
  r: TestRenderer.ReactTestRenderer,
  startsWith: string,
): TestRenderer.ReactTestInstance {
  const b = r.root
    .findAllByType(Button)
    .find(x => typeof x.props.children === 'string' && x.props.children.startsWith(startsWith))
  expect(b, startsWith).toBeDefined()
  return b!
}
function checkbox(
  r: TestRenderer.ReactTestRenderer,
  label: string,
): TestRenderer.ReactTestInstance {
  const c = r.root.findAll(
    n => n.props.accessibilityRole === 'checkbox' && n.props.accessibilityLabel === label,
  )[0]
  expect(c, label).toBeDefined()
  return c!
}
async function press(b: TestRenderer.ReactTestInstance): Promise<void> {
  await act(async () => {
    ;(b.props.onPress as () => void)()
  })
  await flush()
}

describe('IssueImportCard', () => {
  it('Preview_RendersEachProposal_AsNotYetImported', async () => {
    previewIssueImport.mockResolvedValueOnce(OK_PREVIEW)
    const r = render(<IssueImportCard baseUrl="https://api.test" projects={PROJECTS} />)

    await press(button(r, 'Preview GitHub'))

    expect(previewIssueImport).toHaveBeenCalledTimes(1)
    expect(previewIssueImport.mock.calls[0]?.slice(0, 3)).toEqual([
      'https://api.test',
      'github',
      { state: 'open' },
    ])
    const out = tree(r)
    expect(out).toContain('Fix the login bug')
    expect(out).toContain('Add dark mode')
    expect(out).toContain('gh#1')
    expect(out).toContain('bug')
    expect(out).toContain('nothing imported yet')
    // No create happens on a bare preview (ADR-0005).
    expect(createTask).not.toHaveBeenCalled()
  })

  it('NoConsentStatus_ShowsHonestReason_AndImportsNothing', async () => {
    previewIssueImport.mockResolvedValueOnce({ status: 'no-consent', proposals: [] })
    const r = render(<IssueImportCard baseUrl="https://api.test" projects={PROJECTS} />)

    await press(button(r, 'Preview GitHub'))

    const out = tree(r)
    expect(out).toContain('Grant this connector consent')
    expect(out).not.toContain('Import selected')
    expect(createTask).not.toHaveBeenCalled()
  })

  it('SelectAndImport_CreatesOneTaskPerSelectedProposal_AndRecordsTheLink', async () => {
    previewIssueImport.mockResolvedValueOnce(OK_PREVIEW)
    createTask.mockResolvedValue({ id: 'task-1', name: 'Fix the login bug', projectId: 'p1' })
    recordImported.mockResolvedValue({ recorded: 1 })
    const r = render(<IssueImportCard baseUrl="https://api.test" projects={PROJECTS} />)

    await press(button(r, 'Preview GitHub'))
    await press(checkbox(r, 'Select Fix the login bug'))
    await press(button(r, 'Import selected'))

    expect(createTask).toHaveBeenCalledTimes(1)
    expect(createTask).toHaveBeenCalledWith('https://api.test', {
      name: 'Fix the login bug',
      projectId: 'p1',
    })
    // After the create succeeds, the link is recorded so the next preview won't re-propose it.
    expect(recordImported).toHaveBeenCalledTimes(1)
    expect(recordImported).toHaveBeenCalledWith('https://api.test', 'github', [
      { externalKey: 'gh#1', taskId: 'task-1' },
    ])
    expect(tree(r)).toContain('1 task imported into Website')
  })
})
