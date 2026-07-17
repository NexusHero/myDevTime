import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PlannerMonth } from './PlannerMonth.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import type { MonthDay } from '../../planner/calendarMonth'

/**
 * Render tests (ADR-0027) for the Planner Month view (design v18 PlannerViews): tasks show with
 * their label, events surface as their own banner, "+N more" collapses overflow, and an empty
 * month renders the grid without any task/event text.
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

function texts(r: TestRenderer.ReactTestRenderer): string {
  return r.root
    .findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children)
    .filter((c): c is string => typeof c === 'string')
    .join(' ')
}

const days = new Map<number, MonthDay>([
  [
    13,
    {
      tasks: [
        { prio: 1, estHours: 2, label: 'Sync engine', projectId: 'p1', isLife: false },
        { prio: 2, estHours: 1, label: 'Finanzo review', projectId: 'p2', isLife: false },
        { prio: 3, estHours: 0.5, label: 'PR sweep', projectId: 'p3', isLife: false },
        { prio: 2, estHours: 1, label: 'Overflow task', projectId: 'p4', isLife: false },
      ],
      events: [],
      load: 4.5,
    },
  ],
  [17, { tasks: [], events: [{ label: 'Vacation' }], load: 0 }],
  [
    21,
    {
      tasks: [{ prio: 2, estHours: 1, label: 'Kita pickup', projectId: null, isLife: true }],
      events: [],
      load: 0,
    },
  ],
])

describe('PlannerMonth', () => {
  it('RendersTasksAndEvents', () => {
    const out = texts(
      render(<PlannerMonth year={2026} month0={6} today={13} days={days} targetHours={8.33} />),
    )
    expect(out).toContain('Sync engine')
    expect(out).toContain('Vacation')
    expect(out).toContain('Kita pickup') // a life occurrence surfaces in its cell
  })

  it('CollapsesOverflowTasks_toPlusNMore', () => {
    const out = texts(
      render(<PlannerMonth year={2026} month0={6} today={13} days={days} targetHours={8.33} />),
    )
    expect(out).toContain('+1 more') // 4 tasks → 3 shown + 1 more
  })

  it('EmptyMonth_RendersGridWithoutTaskText', () => {
    const out = texts(
      render(<PlannerMonth year={2026} month0={6} today={0} days={new Map()} targetHours={8.33} />),
    )
    expect(out).not.toContain('Sync engine')
    expect(out).toContain('MO') // weekday header still renders
  })
})
