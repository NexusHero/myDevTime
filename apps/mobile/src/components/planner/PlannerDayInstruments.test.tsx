import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PlannerDayInstruments } from './PlannerDayInstruments.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render test (ADR-0027) for the Planner Day instruments rail (design v20). Under the gate the
 * worktime hook runs in demo mode (no API), so nothing is clocked — the rail says so honestly
 * rather than inventing a figure.
 */
function mount(): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <PlannerDayInstruments />
      </ThemeProvider>,
    )
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

describe('PlannerDayInstruments', () => {
  it('ShowsTheTodayAndMoodCardsWithHonestNotClockedState', () => {
    const out = texts(mount())
    expect(out).toContain('Today')
    expect(out).toContain('Not clocked in') // no fabricated worked/soll figure
    expect(out).toContain('Overtime balance')
    expect(out).toContain("How's it going?")
    expect(out).toContain('Good')
  })

  it('SelectingAMoodMarksItSelected', () => {
    const r = mount()
    const good = r.root
      .findAll(n => n.props.accessibilityRole === 'button')
      .find(n => n.props.accessibilityLabel === 'Good')
    expect(good).toBeDefined()
    act(() => {
      good?.props.onPress()
    })
    const again = r.root
      .findAll(n => n.props.accessibilityRole === 'button')
      .find(n => n.props.accessibilityLabel === 'Good')
    expect(again?.props.accessibilityState).toEqual({ selected: true })
  })
})
