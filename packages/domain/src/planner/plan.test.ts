import { describe, expect, it } from 'vitest'
import { buildDayPlan, reviewDayPlan, type PlanCandidate, type PlanInput } from './plan.js'

/**
 * The deterministic Co-Planner core (REQ-031, ADR-0011): meetings anchor, focus
 * blocks fill the free gaps by priority, breaks satisfy the rules, and overflow is
 * reported — no LLM (the AI only ranks/labels within these code-enforced blocks,
 * ADR-0005). Every placement is exact and reproducible.
 */
const task = (id: string, estimateMin: number, priority: number): PlanCandidate => ({
  id,
  label: id,
  estimateMin,
  priority,
})

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  dayStartMin: 8 * 60, // 08:00
  dayEndMin: 18 * 60, // 18:00
  anchors: [],
  backlog: [],
  breakAfterMin: 90,
  breakLenMin: 15,
  minBlockMin: 15,
  ...over,
})

describe('buildDayPlan', () => {
  it('PlacesAnchorsAsMeetingsInOrder', () => {
    const plan = buildDayPlan(
      base({
        anchors: [
          { startMin: 11 * 60, lenMin: 60, label: 'Standup off-site' },
          { startMin: 9 * 60, lenMin: 30, label: 'Daily' },
        ],
      }),
    )
    const meetings = plan.blocks.filter(b => b.kind === 'meeting')
    expect(meetings.map(m => m.label)).toEqual(['Daily', 'Standup off-site'])
    expect(meetings[0]!.startMin).toBe(9 * 60)
  })

  it('FillsFreeGapsWithFocusByPriority', () => {
    const plan = buildDayPlan(
      base({
        backlog: [task('low', 120, 5), task('urgent', 120, 1)],
        breakAfterMin: 600, // no breaks for this case
      }),
    )
    const focus = plan.blocks.filter(b => b.kind === 'focus')
    // Highest priority (lowest number) is placed first.
    expect(focus[0]!.taskId).toBe('urgent')
    expect(plan.plannedFocusMin).toBe(240)
  })

  it('InsertsABreakAfterTheFocusThreshold', () => {
    const plan = buildDayPlan(
      base({ backlog: [task('deep', 300, 1)], breakAfterMin: 90, breakLenMin: 15 }),
    )
    const kinds = plan.blocks.map(b => b.kind)
    expect(kinds).toContain('break')
    // First focus run is capped at the 90-min threshold.
    expect(plan.blocks[0]!.kind).toBe('focus')
    expect(plan.blocks[0]!.lenMin).toBe(90)
    expect(plan.blocks[1]!.kind).toBe('break')
    expect(plan.blocks[1]!.lenMin).toBe(15)
  })

  it('WorksAroundAnchorsUsingOnlyTheGaps', () => {
    // A 60-min meeting at 09:00 splits the morning; focus fills before and after.
    const plan = buildDayPlan(
      base({
        dayStartMin: 8 * 60,
        dayEndMin: 12 * 60, // 4h window
        anchors: [{ startMin: 9 * 60, lenMin: 60, label: 'Review' }],
        backlog: [task('t', 600, 1)],
        breakAfterMin: 600,
      }),
    )
    // 4h window − 1h meeting = 3h focus available.
    expect(plan.plannedFocusMin).toBe(180)
    const focusBeforeMeeting = plan.blocks.find(b => b.kind === 'focus')!
    expect(focusBeforeMeeting.startMin).toBe(8 * 60)
    expect(focusBeforeMeeting.lenMin).toBe(60) // 08:00–09:00
  })

  it('ReportsUnplacedOverflow', () => {
    // 10h of backlog into a 2h window → 8h can't be placed.
    const plan = buildDayPlan(
      base({
        dayStartMin: 8 * 60,
        dayEndMin: 10 * 60,
        backlog: [task('big', 600, 1)],
        breakAfterMin: 600,
      }),
    )
    expect(plan.plannedFocusMin).toBe(120)
    expect(plan.unplacedMin).toBe(480)
  })

  it('IsDeterministicAndLeavesTinyGapsEmpty', () => {
    const input = base({ backlog: [task('a', 50, 1)], minBlockMin: 60, breakAfterMin: 600 })
    const p1 = buildDayPlan(input)
    const p2 = buildDayPlan(input)
    expect(p1).toEqual(p2)
    // A 50-min task with a 60-min minimum still places (finishing a candidate),
    // but no sub-minBlock sliver is invented beyond it.
    expect(p1.plannedFocusMin).toBe(50)
  })
})

describe('buildDayPlan — edge cases', () => {
  it('SkipsAnchorsThatOverlapAKeptOne', () => {
    const plan = buildDayPlan(
      base({
        anchors: [
          { startMin: 9 * 60, lenMin: 60, label: 'Kept' },
          { startMin: 9 * 60 + 30, lenMin: 60, label: 'Overlap' }, // starts inside "Kept"
        ],
      }),
    )
    const meetings = plan.blocks.filter(b => b.kind === 'meeting')
    expect(meetings.map(m => m.label)).toEqual(['Kept'])
  })

  it('ReportsOverlappingAnchorsAsDroppedInsteadOfSwallowingThem', () => {
    // Three meetings in the same slot: only the first is placed; the two that
    // overlap it must be reported so an overbooked user is warned, not misled.
    const plan = buildDayPlan(
      base({
        anchors: [
          { startMin: 9 * 60, lenMin: 60, label: 'Kept' },
          { startMin: 9 * 60 + 15, lenMin: 30, label: 'Clash A' },
          { startMin: 9 * 60 + 30, lenMin: 60, label: 'Clash B' },
        ],
      }),
    )
    expect(plan.blocks.filter(b => b.kind === 'meeting').map(m => m.label)).toEqual(['Kept'])
    expect(plan.droppedAnchors.map(a => a.label)).toEqual(['Clash A', 'Clash B'])
  })

  it('ReportsAnchorsFullyOutsideTheWindowAsDropped', () => {
    const plan = buildDayPlan(
      base({ anchors: [{ startMin: 20 * 60, lenMin: 60, label: 'Evening' }] }),
    )
    expect(plan.droppedAnchors.map(a => a.label)).toEqual(['Evening'])
  })

  it('DropsNoAnchorsWhenNoneOverlap', () => {
    const plan = buildDayPlan(
      base({
        anchors: [
          { startMin: 9 * 60, lenMin: 30, label: 'A' },
          { startMin: 11 * 60, lenMin: 30, label: 'B' },
        ],
      }),
    )
    expect(plan.droppedAnchors).toEqual([])
  })

  it('ClipsAnchorsToTheDayWindow', () => {
    const plan = buildDayPlan(
      base({
        dayStartMin: 8 * 60,
        dayEndMin: 18 * 60,
        anchors: [{ startMin: 7 * 60, lenMin: 120, label: 'Early' }], // 07:00–09:00 → clip to 08:00
      }),
    )
    const meeting = plan.blocks.find(b => b.kind === 'meeting')!
    expect(meeting.startMin).toBe(8 * 60)
    expect(meeting.lenMin).toBe(60) // 08:00–09:00
  })

  it('DropsAnchorsFullyOutsideTheWindow', () => {
    const plan = buildDayPlan(
      base({ anchors: [{ startMin: 20 * 60, lenMin: 60, label: 'Evening' }] }),
    )
    expect(plan.blocks.filter(b => b.kind === 'meeting')).toEqual([])
  })

  it('LeavesAGapEmptyWhenTheBacklogIsExhausted', () => {
    const plan = buildDayPlan(base({ backlog: [task('t', 60, 1)], breakAfterMin: 600 }))
    expect(plan.plannedFocusMin).toBe(60)
    expect(plan.blocks.filter(b => b.kind === 'focus')).toHaveLength(1)
    expect(plan.unplacedMin).toBe(0)
  })

  it('TruncatesATrailingBreakToTheRoomLeft', () => {
    // 100-min window, 90-min focus threshold → after 90m focus only 10m room,
    // so the break is truncated to 10m (< the 15m default).
    const plan = buildDayPlan(
      base({
        dayStartMin: 0,
        dayEndMin: 100,
        backlog: [task('deep', 300, 1)],
        breakAfterMin: 90,
        breakLenMin: 15,
        minBlockMin: 1,
      }),
    )
    const brk = plan.blocks.find(b => b.kind === 'break')!
    expect(brk.lenMin).toBe(10)
  })
})

describe('reviewDayPlan', () => {
  it('ReportsDriftOfTrackedVsPlannedFocus', () => {
    const plan = buildDayPlan(base({ backlog: [task('t', 180, 1)], breakAfterMin: 600 }))
    const review = reviewDayPlan(plan, 150)
    expect(review.plannedFocusMin).toBe(180)
    expect(review.trackedFocusMin).toBe(150)
    expect(review.driftMin).toBe(-30)
  })
})
