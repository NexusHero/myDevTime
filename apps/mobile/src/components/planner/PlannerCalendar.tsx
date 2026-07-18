import { buildMonthDays, buildYearMonths } from '../../planner/calendarMonth'
import type { Occurrence } from '../../api/recurrence'
import { PlannerMonth } from './PlannerMonth'
import { PlannerYear } from './PlannerYear'

/**
 * The Planner calendar surface (design v20, ADR-0068). This is the platform seam for the binding
 * FullCalendar directive: on the **web** target `PlannerCalendar.web.tsx` renders FullCalendar
 * (MIT plugins, custom event renderers); on **native** and under the test suite this file renders
 * the hand-built RN grid (`PlannerMonth`/`PlannerYear` over `@mydevtime/design`'s pure `monthGrid`),
 * so iOS/Android never import the DOM-only library (ADR-0004). Both consume the **same** shaped
 * occurrences and produce the same figures via the deterministic `buildMonthDays`/`buildYearMonths`
 * (ADR-0005) — the calendar library only lays out and renders; it computes no number.
 */
export interface PlannerCalendarProps {
  readonly view: 'month' | 'year' | 'week' | 'day'
  readonly year: number
  /** 0-based month for the month view. */
  readonly month0: number
  /** `YYYY-MM-DD` anchor for the week/day timegrid (design v20 §Cal); month/year ignore it. */
  readonly anchorDate?: string
  /** Day-of-month to flag as today (0 when today is in another month). */
  readonly today: number
  /** Layer-filtered occurrences to lay out. */
  readonly occurrences: readonly Occurrence[]
  /** Daily target hours the month load bar/tone compares against. */
  readonly targetHours: number
  readonly onDrillDay?: (day: number) => void
  readonly onDrillMonth?: (month0: number) => void
}

export function PlannerCalendar({
  view,
  year,
  month0,
  today,
  occurrences,
  targetHours,
  onDrillDay,
  onDrillMonth,
}: PlannerCalendarProps): React.JSX.Element {
  if (view === 'year') {
    return (
      <PlannerYear
        months={buildYearMonths(occurrences, [], { year, nowMonth0: month0 })}
        {...(onDrillMonth ? { onDrill: onDrillMonth } : {})}
      />
    )
  }
  // Week/Day are the FullCalendar timegrid zooms on web (`.web.tsx`, design v20 §Cal). On native
  // the day-level canvas lives in `PlannerScreen`'s hand-built RN grid, so here `week`/`day` fall
  // through to the same month grid — an interim surface, never a broken one; the `anchorDate` prop
  // is only consumed by the web timegrid.
  return (
    <PlannerMonth
      year={year}
      month0={month0}
      today={today}
      days={buildMonthDays(occurrences, [], { year, month0 })}
      targetHours={targetHours}
      {...(onDrillDay ? { onDrill: onDrillDay } : {})}
    />
  )
}
