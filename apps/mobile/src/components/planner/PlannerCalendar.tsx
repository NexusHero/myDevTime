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
/**
 * An editable local canvas block for the **web** week/day timegrid (design v20 §Cal). `day` is the
 * 0-based column offset from the shown week's Monday; `startMin` is minutes from 08:00; `lenMin` the
 * duration. Native ignores these entirely — it keeps the hand-built RN `DayColumn` canvas — so this
 * shape only feeds FullCalendar's drag/resize on web. The `index` is the block's position in the
 * array the Planner passes to its move/resize handlers, so an edit maps straight back to state.
 */
export interface TimegridBlock {
  readonly index: number
  readonly day: number
  readonly startMin: number
  readonly lenMin: number
  readonly label: string
  readonly color: string
  readonly kind: string
}

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
  /** Editable blocks for the web timegrid (design v20 §Cal); native ignores them. */
  readonly editableBlocks?: readonly TimegridBlock[]
  /** Local midnight (ms) of the shown week's Monday — the anchor for day+min ↔ datetime on web. */
  readonly weekStartMs?: number
  /** Web timegrid: a block was dragged to a new day/time (both snapped to 15 min). */
  readonly onBlockMove?: (index: number, day: number, startMin: number) => void
  /** Web timegrid: a block's duration changed at its edge (snapped to 15 min). */
  readonly onBlockResize?: (index: number, lenMin: number) => void
  /** Web timegrid: a block was clicked → open its typed drawer. */
  readonly onBlockOpen?: (index: number) => void
  /** Web timegrid: an empty slot was selected → create a block at that day/time. */
  readonly onSlotCreate?: (day: number, startMin: number) => void
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
