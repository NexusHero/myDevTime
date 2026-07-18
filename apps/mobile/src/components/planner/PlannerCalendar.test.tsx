import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PlannerCalendar } from './PlannerCalendar.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import type { Occurrence } from '../../api/recurrence'

/**
 * Render tests (ADR-0027) for the native Planner calendar seam (ADR-0068): on native + under the
 * test suite it delegates to the tested RN grid (`PlannerMonth`/`PlannerYear`) — the FullCalendar
 * web variant lives in `PlannerCalendar.web.tsx` and is bundled only on web. Same occurrences in,
 * same figures out (deterministic `buildMonthDays`/`buildYearMonths`).
 */
function texts(node: React.ReactElement): string {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r.root
    .findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children)
    .filter((c): c is string => typeof c === 'string')
    .join(' ')
}

const occ = (date: string, title: string): Occurrence => ({
  seriesId: 's',
  kind: 'focus',
  title,
  date,
  startMin: 540,
  lenMin: 120,
  projectId: 'p1',
  priority: 1,
  note: null,
})

describe('PlannerCalendar (native)', () => {
  it('Month_RendersTheDayGridWithOccurrenceTasks', () => {
    const out = texts(
      <PlannerCalendar
        view="month"
        year={2026}
        month0={6}
        today={13}
        occurrences={[occ('2026-07-13', 'Sync engine')]}
        targetHours={8.33}
      />,
    )
    expect(out).toContain('MO') // weekday header from the RN month grid
    expect(out).toContain('Sync engine')
  })

  it('Week_FallsThroughToTheInterimMonthGridOnNative', () => {
    // On native the timegrid week/day is the web-only FullCalendar zoom (design v20 §Cal); the
    // native seam renders the same tested month grid so the surface is never broken.
    const out = texts(
      <PlannerCalendar
        view="week"
        year={2026}
        month0={6}
        anchorDate="2026-07-13"
        today={13}
        occurrences={[occ('2026-07-13', 'Sync engine')]}
        targetHours={8.33}
      />,
    )
    expect(out).toContain('MO')
    expect(out).toContain('Sync engine')
  })

  it('Year_RendersTwelveMonthCards', () => {
    const out = texts(
      <PlannerCalendar
        view="year"
        year={2026}
        month0={6}
        today={0}
        occurrences={[]}
        targetHours={8.33}
      />,
    )
    expect(out).toContain('Jul')
    expect(out).toContain('Jan')
  })

  it('Year_ShowsPlannedHoursFromTheUtilizationCore_REQ046', () => {
    // The Year strip is fed by the deterministic utilization aggregation (`buildYearMonths` →
    // `dayLoad`/`weekIntensity`, REQ-046): a single 2 h occurrence in July renders as "2h", every
    // empty month as "—". This pins that the views render straight from that core, no mock data.
    const out = texts(
      <PlannerCalendar
        view="year"
        year={2026}
        month0={6}
        today={0}
        occurrences={[occ('2026-07-13', 'Sync engine')]}
        targetHours={8.33}
      />,
    )
    expect(out).toContain('2h')
    expect(out).toContain('—')
  })
})
