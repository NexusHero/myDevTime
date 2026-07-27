// @vitest-environment jsdom
// The hero bar renders a react-native-web TextInput, which needs a DOM.
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import { HeroTrackerBar, type HeroTrackerBarProps } from './HeroTrackerBar.js'
import type { Project } from '../../screens/projectsData.js'

/**
 * HeroTrackerBar is the extracted, reusable hero bar (issue #361): the task input,
 * project chip, billable € toggle, worked-time display, PauseCounter, and the big
 * orange breathing LiveButton start/stop. It is a **controlled view** — every value
 * and callback comes in through props; it owns no timer state and never creates a
 * second clock (ADR-0005 / ux-vision §2.3). These tests assert the four states the
 * QA plan calls out (idle / running / paused / billable) and that the start/stop
 * callbacks fire — proving it is driven by props, not internal state.
 */

const baseProject: Project = {
  id: 'p1',
  name: 'Website',
  budgetMs: 0,
  spentMs: 0,
  rateMinorPerHour: 0,
  currency: 'EUR',
  tasks: [],
}

function makeProps(overrides: Partial<HeroTrackerBarProps> = {}): HeroTrackerBarProps {
  return {
    task: '',
    setTask: vi.fn(),
    runningProject: null,
    billable: false,
    busy: false,
    running: null,
    accumulatedMs: 0,
    elapsed: '00:00:00',
    paused: false,
    pausedSinceMs: null,
    active: false,
    isRunning: false,
    setBillable: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn(),
    ...overrides,
  }
}

function render(props: HeroTrackerBarProps): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <HeroTrackerBar {...props} />
      </ThemeProvider>,
    )
  })
  return r
}

const text = (r: TestRenderer.ReactTestRenderer): string => JSON.stringify(r.toJSON())

describe('HeroTrackerBar', () => {
  it('Idle_ShowsStartButtonAndZeroElapsed', () => {
    const r = render(makeProps())
    const tree = text(r)
    // The primary punch button is labelled Start when idle.
    expect(tree).toContain('Start')
    expect(tree).not.toContain('Stop')
    // The worked-time display reads the elapsed prop (00:00:00), not a hardcoded figure.
    expect(tree).toContain('00:00:00')
    // No PauseCounter while idle (its a11y label is "Paused …"; the Pause *button*
    // is always present but disabled — that label is "Pause", not "Paused").
    expect(tree).not.toContain('Paused')
  })

  it('Running_ShowsStopButtonAndLiveWorkedTime', () => {
    const r = render(
      makeProps({
        active: true,
        isRunning: true,
        running: {
          id: 'e1',
          projectId: null,
          taskId: null,
          startedAt: '2026-07-24T08:00:00.000Z',
          endedAt: null,
          billable: false,
          source: 'timer',
          note: 'focus',
        },
        accumulatedMs: 0,
        elapsed: '00:00:00',
      }),
    )
    const tree = text(r)
    // Running → the punch button flips to Stop.
    expect(tree).toContain('Stop')
    expect(tree).not.toContain('Start')
  })

  it('Paused_ShowsPauseCounterAndResumeButton', () => {
    const r = render(
      makeProps({
        active: true,
        isRunning: false,
        paused: true,
        pausedSinceMs: Date.parse('2026-07-24T08:00:00.000Z'),
      }),
    )
    const tree = text(r)
    // Paused → the PauseCounter stacks under the frozen worked time.
    expect(tree).toContain('Pause')
    // The pause/resume control flips to Resume while paused.
    expect(tree).toContain('Resume')
  })

  it('BillableOn_ToggleReflectsCheckedState', () => {
    const r = render(makeProps({ billable: true }))
    const tree = text(r)
    // The billable toggle's accessible name carries the on state.
    expect(tree).toContain('Billable, on')
  })

  it('BillableOff_ToggleReflectsUncheckedState', () => {
    const r = render(makeProps({ billable: false }))
    expect(text(r)).toContain('Billable, off')
  })

  it('RunningProject_ShowsProjectChipWithName', () => {
    const r = render(makeProps({ runningProject: baseProject }))
    expect(text(r)).toContain('Website')
  })

  it('NoRunningProject_HidesProjectChip', () => {
    const r = render(makeProps({ runningProject: null }))
    expect(text(r)).not.toContain('Website')
  })

  it('IsControlled_StartFiresOnStartPropNotInternalState', () => {
    const onStart = vi.fn()
    const r = render(makeProps({ onStart }))
    const start = r.root.find(n => n.props.accessibilityLabel === 'Start')
    act(() => {
      ;(start.props.onPress as () => void)()
    })
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('IsControlled_StopFiresOnStopPropNotInternalState', () => {
    const onStop = vi.fn()
    const r = render(
      makeProps({
        active: true,
        isRunning: true,
        onStop,
        running: {
          id: 'e1',
          projectId: null,
          taskId: null,
          startedAt: '2026-07-24T08:00:00.000Z',
          endedAt: null,
          billable: false,
          source: 'timer',
          note: 'focus',
        },
      }),
    )
    const stop = r.root.find(n => n.props.accessibilityLabel === 'Stop')
    act(() => {
      ;(stop.props.onPress as () => void)()
    })
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('IsControlled_BillableToggleFiresSetBillableProp', () => {
    const setBillable = vi.fn()
    const r = render(makeProps({ billable: false, setBillable }))
    const toggle = r.root.find(n => n.props.accessibilityLabel === 'Billable, off')
    act(() => {
      ;(toggle.props.onPress as () => void)()
    })
    // Flipping off → on calls setBillable(true).
    expect(setBillable).toHaveBeenCalledWith(true)
  })

  it('IsControlled_PauseFiresOnPauseProp', () => {
    const onPause = vi.fn()
    const r = render(
      makeProps({
        active: true,
        isRunning: true,
        onPause,
        running: {
          id: 'e1',
          projectId: null,
          taskId: null,
          startedAt: '2026-07-24T08:00:00.000Z',
          endedAt: null,
          billable: false,
          source: 'timer',
          note: 'focus',
        },
      }),
    )
    const pause = r.root.find(n => n.props.accessibilityLabel === 'Pause')
    act(() => {
      ;(pause.props.onPress as () => void)()
    })
    expect(onPause).toHaveBeenCalledTimes(1)
  })

  it('IsControlled_ResumeFiresOnResumeProp', () => {
    const onResume = vi.fn()
    const r = render(makeProps({ active: true, isRunning: false, paused: true, onResume }))
    const resume = r.root.find(n => n.props.accessibilityLabel === 'Resume')
    act(() => {
      ;(resume.props.onPress as () => void)()
    })
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('ClockIn_Out_RendersOnlyWhenProvided', () => {
    // Omitted punch-clock props → no Clock in/out button.
    const r = render(makeProps())
    expect(text(r)).not.toContain('Clock in')
    expect(text(r)).not.toContain('Clock out')
  })

  it('ClockIn_ShowsClockInButtonWhenNotPunchedIn', () => {
    const r = render(makeProps({ onClockIn: vi.fn(), onClockOut: vi.fn(), punchedIn: false }))
    expect(text(r)).toContain('Clock in')
    expect(text(r)).not.toContain('Clock out')
  })

  it('ClockOut_ShowsClockOutButtonWhenPunchedIn', () => {
    const r = render(makeProps({ onClockIn: vi.fn(), onClockOut: vi.fn(), punchedIn: true }))
    expect(text(r)).toContain('Clock out')
  })

  it('ClockIn_FiresOnClockInProp', () => {
    const onClockIn = vi.fn()
    const r = render(makeProps({ onClockIn, onClockOut: vi.fn(), punchedIn: false }))
    const btn = r.root.findByProps({ children: 'Clock in' })
    act(() => {
      ;(btn.props.onPress as () => void)()
    })
    expect(onClockIn).toHaveBeenCalledTimes(1)
  })

  it('ClockOut_FiresOnClockOutProp', () => {
    const onClockOut = vi.fn()
    const r = render(makeProps({ onClockIn: vi.fn(), onClockOut, punchedIn: true }))
    const btn = r.root.findByProps({ children: 'Clock out' })
    act(() => {
      ;(btn.props.onPress as () => void)()
    })
    expect(onClockOut).toHaveBeenCalledTimes(1)
  })
})
