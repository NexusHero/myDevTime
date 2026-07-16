// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import type { ReactTestInstance } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { TestQueryProvider } from '../test/TestQueryProvider.js'

/**
 * The Task detail screen surfaces an entry's note as its row title and offers a
 * note search over the loaded entries (REQ-036). The app fabricates no data, so the
 * catalog + entries are injected through the hook seams. FlashList virtualizes the
 * rows (not asserted here — the filter semantics are proven in the domain
 * `search.test.ts`); this pins that the screen mounts with entries present and the
 * always-mounted "Search notes…" affordance is wired into the list header.
 */
vi.mock('./useCatalog', () => ({
  useCatalog: () => ({
    data: [
      {
        id: 'nexushero',
        name: 'NexusHero',
        projects: [
          {
            id: 'p1',
            name: 'Finanzo',
            tasks: [{ id: 't1', name: 'Invoicing', spentMs: 3_600_000, done: false }],
          },
        ],
      },
    ],
    loading: false,
    error: null,
    reload: () => undefined,
    live: true,
  }),
}))

vi.mock('../hooks/useTaskEntries', () => ({
  useTaskEntries: () => ({
    data: [
      {
        id: 'e1',
        startedAt: '2026-07-08T09:00:00.000Z',
        endedAt: '2026-07-08T10:00:00.000Z',
        source: 'timer',
        note: 'Finanzo invoice fix',
        taskId: 't1',
      },
    ],
    loading: false,
    error: null,
    reload: () => undefined,
    live: true,
  }),
}))

const { TaskScreen } = await import('./TaskScreen.js')

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer
  await act(async () => {
    renderer = TestRenderer.create(
      <TestQueryProvider>
        <ThemeProvider>
          <TaskScreen taskId="t1" onNavigate={() => undefined} />
        </ThemeProvider>
      </TestQueryProvider>,
    )
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return renderer
}

/** All placeholder strings present anywhere in the rendered tree. */
function placeholders(root: ReactTestInstance): string[] {
  return root
    .findAll(node => typeof node.props.placeholder === 'string')
    .map(node => node.props.placeholder as string)
}

describe('TaskScreen', () => {
  it('TaskScreen_WithEntries_MountsAndWiresTheNoteSearch', async () => {
    const renderer = await render()

    expect(placeholders(renderer.root)).toContain('Search notes…')

    renderer.unmount()
  })
})
