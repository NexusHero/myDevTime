import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Text as RNText } from 'react-native'
import { PlannerMonthView } from './PlannerMonthView.js'
import { PlannerYearView } from './PlannerYearView.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * The Monat/Jahr facets are presentational (the load math is unit-tested in
 * `@mydevtime/design`), so these are smoke tests: they render under the theme and
 * assert the task/event distinction and the twelve-month grid actually appear.
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

const texts = (r: TestRenderer.ReactTestRenderer): string[] =>
  r.root
    .findAllByType(RNText)
    .flatMap(n => n.props.children)
    .filter((c): c is string => typeof c === 'string')

describe('PlannerMonthView', () => {
  it('PlannerMonthView_rendersWeekdayHeadersAndTasksAndEvents', () => {
    const all = texts(render(<PlannerMonthView />)).join(' | ')
    expect(all).toContain('Mo') // weekday header
    expect(all).toContain('Sync engine') // a task chip (day 13)
    expect(all).toContain('Sommerfest (nachm.)') // an event banner (day 3)
  })
})

describe('PlannerYearView', () => {
  it('PlannerYearView_rendersTwelveMonthsAndMarksNow', () => {
    const all = texts(render(<PlannerYearView />))
    for (const m of ['Jan', 'Jun', 'Jul', 'Dez']) expect(all).toContain(m)
    expect(all).toContain('Jetzt') // the current month badge (Jul)
  })
})
