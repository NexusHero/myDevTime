import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PlannerMonth } from './PlannerMonth.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import type { MonthDay } from '../../planner/calendarMonth'

/**
 * Render tests (ADR-0027) for the redesigned Planner Month heatmap (issue #366, ADR-0075):
 * borderless rounded cells with a 5-step accent heat fill (the fill IS the load signal),
 * quiet day numbers, an accent ring on today (not an orange pill), an ink3 booking-gap
 * marker (not warn), and the inline load number hidden by default. Tasks stay legible
 * above the heat fill; every cell keeps an accessibilityLabel with day + load (REQ-043).
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

function labels(r: TestRenderer.ReactTestRenderer): string[] {
  return r.root
    .findAll(n => typeof n.props.accessibilityLabel === 'string')
    .map(n => n.props.accessibilityLabel as string)
}

/** A `DayTask` fixture — the span/kind carry the detail a tapped chip opens (issue #370). */
function task(
  over: Partial<MonthDay['tasks'][number]> & { readonly label: string },
): MonthDay['tasks'][number] {
  return {
    prio: 2,
    estHours: 1,
    projectId: null,
    isLife: false,
    kind: 'focus',
    startMin: 540,
    lenMin: 60,
    ...over,
  }
}

const days = new Map<number, MonthDay>([
  [
    13,
    {
      tasks: [
        task({ prio: 1, estHours: 2, label: 'Sync engine', projectId: 'p1', lenMin: 120 }),
        task({ label: 'Finanzo review', projectId: 'p2' }),
        task({ prio: 3, estHours: 0.5, label: 'PR sweep', projectId: 'p3', lenMin: 30 }),
        task({ label: 'Overflow task', projectId: 'p4' }),
      ],
      events: [],
      load: 4.5,
    },
  ],
  [17, { tasks: [], events: [{ label: 'Vacation' }], load: 0 }],
  [
    21,
    {
      tasks: [task({ label: 'Kita pickup', isLife: true, kind: 'life' })],
      events: [],
      load: 0,
    },
  ],
])

describe('PlannerMonth heatmap (issue #366)', () => {
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

  it('CellAccessibilityLabel_CarriesDayAndLoad', () => {
    // REQ-043: the color is decorative; the a11y label carries the day + load meaning.
    const r = render(
      <PlannerMonth year={2026} month0={6} today={13} days={days} targetHours={8.33} />,
    )
    const lbls = labels(r)
    // Day 13 has load 4.5 → the label includes the day number and the load figure.
    expect(lbls.some(l => l.startsWith('13') && l.includes('4.5'))).toBe(true)
  })

  it('GapDayAccessibilityLabel_SaysNothingBooked', () => {
    // A past weekday with no entry is an honest "nothing booked here" — the label says so.
    const r = render(
      <PlannerMonth year={2026} month0={6} today={13} days={days} targetHours={8.33} />,
    )
    const lbls = labels(r)
    expect(lbls.some(l => l.includes('nothing booked'))).toBe(true)
  })

  it('InlineLoadNumber_HiddenByDefault', () => {
    // The heat fill IS the load signal; the inline fmtLoad number is hidden by default.
    const out = texts(
      render(<PlannerMonth year={2026} month0={6} today={13} days={days} targetHours={8.33} />),
    )
    // The load figure (4.5) appears only in the a11y label, not as visible cell text.
    expect(out).not.toContain('4.5')
  })
})

/**
 * Opening an entry straight from the month (issue #370): a chip is the entry, so tapping it
 * opens that entry's detail — the day drill stays on the cell around it. Without this, the month
 * could only ever zoom into the day, never show what a given entry actually is.
 */
describe('PlannerMonth · open an entry from a chip', () => {
  function chip(
    r: TestRenderer.ReactTestRenderer,
    label: string,
  ): TestRenderer.ReactTestInstance | undefined {
    return r.root
      .findAll(n => typeof n.props.accessibilityLabel === 'string')
      .find(n => (n.props.accessibilityLabel as string).startsWith(`Open ${label}`))
  }

  it('TaskChip_IsPressable_andReportsItsDayAndIndex', () => {
    const onOpenTask = vi.fn()
    const r = render(
      <PlannerMonth
        year={2026}
        month0={6}
        today={13}
        days={days}
        targetHours={8.33}
        onOpenTask={onOpenTask}
      />,
    )
    const c = chip(r, 'Finanzo review')
    expect(c, 'a pressable chip for the entry').toBeDefined()
    act(() => {
      c!.props.onPress({ stopPropagation: () => undefined })
    })
    // Day 13, second task in that cell — enough for the screen to resolve the entry.
    expect(onOpenTask).toHaveBeenCalledWith(13, 1)
  })

  it('TappingAChipDoesNotAlsoDrillIntoTheDay', () => {
    // Nested pressables: on the web renderer the click would otherwise bubble to the cell and
    // the detail would open *and* the view would jump to the Day — one tap, one outcome.
    const onOpenTask = vi.fn()
    const onDrill = vi.fn()
    const stopPropagation = vi.fn()
    const r = render(
      <PlannerMonth
        year={2026}
        month0={6}
        today={13}
        days={days}
        targetHours={8.33}
        onDrill={onDrill}
        onOpenTask={onOpenTask}
      />,
    )
    act(() => {
      chip(r, 'Sync engine')!.props.onPress({ stopPropagation })
    })
    expect(stopPropagation).toHaveBeenCalled()
    expect(onOpenTask).toHaveBeenCalledTimes(1)
  })

  it('WithoutTheCallbackTheChipsStayInert', () => {
    // No handler → no affordance: the month keeps its plain drill behaviour.
    const r = render(
      <PlannerMonth year={2026} month0={6} today={13} days={days} targetHours={8.33} />,
    )
    expect(chip(r, 'Sync engine')).toBeUndefined()
  })
})
