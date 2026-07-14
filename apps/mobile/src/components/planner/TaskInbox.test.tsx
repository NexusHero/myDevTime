// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { TaskInbox } from './TaskInbox.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import type { InboxTask } from '../../screens/plannerInboxData.js'

/**
 * The inbox rail is presentational (slot-finding is unit-tested in the design
 * package), so these smoke-test the render + that "Planen" reports the task.
 */
const TASKS: InboxTask[] = [
  { key: 'FIN-1', title: 'Alpha', est: 1, prio: 1, tag: 'Bug', project: 0, src: 'Jira', desc: 'x' },
  {
    key: 'SYNC-2',
    title: 'Beta',
    est: 2,
    prio: 2,
    tag: 'Feature',
    project: 1,
    src: 'Linear',
    desc: 'y',
  },
]

function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

describe('TaskInbox', () => {
  it('TaskInbox_planButton_reportsTheTask', () => {
    const onPlan = vi.fn()
    const r = render(<TaskInbox tasks={TASKS} onPlan={onPlan} onDone={() => undefined} />)
    const planButtons = r.root
      .findAllByType(Pressable)
      .filter(p => p.props.accessibilityLabel === 'Planen')
    expect(planButtons.length).toBe(TASKS.length)
    act(() => {
      planButtons[0]!.props.onPress()
    })
    expect(onPlan).toHaveBeenCalledOnce()
    expect(onPlan.mock.calls[0]?.[0]?.key).toBeTypeOf('string')
  })
})
