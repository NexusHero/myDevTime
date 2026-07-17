import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PlannerYear } from './PlannerYear.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import { buildYearMonths } from '../../planner/calendarMonth.js'

/**
 * Render tests (ADR-0027) for the Planner Year view (design v18 PlannerViews): every month renders,
 * the current month shows the NOW flag, a month with hours shows them, and an empty month reads "—".
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

describe('PlannerYear', () => {
  it('RendersAllTwelveMonthsWithTheCurrentFlagged', () => {
    const months = buildYearMonths([], [], { year: 2026, nowMonth0: 6 })
    const out = texts(render(<PlannerYear months={months} />))
    expect(out).toContain('Jan')
    expect(out).toContain('Dec')
    expect(out).toContain('NOW')
  })

  it('EmptyMonth_ShowsEmDash', () => {
    const months = buildYearMonths([], [], { year: 2026, nowMonth0: 6 })
    expect(texts(render(<PlannerYear months={months} />))).toContain('—')
  })

  it('MonthWithHours_ShowsThem', () => {
    const months = buildYearMonths(
      [
        {
          seriesId: 's',
          kind: 'focus',
          title: 'A',
          date: '2026-02-03',
          startMin: 540,
          lenMin: 300,
          projectId: null,
          priority: null,
          note: null,
        },
      ],
      [],
      { year: 2026, nowMonth0: 6 },
    )
    expect(texts(render(<PlannerYear months={months} />))).toContain('5h')
  })
})
