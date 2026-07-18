import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PlannerDayTracker } from './PlannerDayTracker.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import { ToastProvider } from '../core/Toast.js'
import { TimerProvider } from '../../timer/TimerContext.js'
import type { Client } from '../../screens/projectsData.js'

/**
 * Render tests (ADR-0027) for the Planner Day tracker row (design v20). It drives the shared timer
 * (demo mode under the gate) and the punch clock, and confirms through `ToastProvider`.
 */
const CLIENTS: readonly Client[] = [
  {
    id: 'c1',
    name: 'Acme',
    projects: [
      {
        id: 'p1',
        name: 'Sync engine',
        budgetMs: 0,
        spentMs: 0,
        rateMinorPerHour: 0,
        currency: 'EUR',
        tasks: [{ id: 't1', name: 'Conflict resolution', spentMs: 0 }],
      },
    ],
  },
]

function mount(clients: readonly Client[]): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          <TimerProvider>
            <PlannerDayTracker clients={clients} />
          </TimerProvider>
        </ToastProvider>
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

describe('PlannerDayTracker', () => {
  it('Idle_ShowsPickerStartPauseAndClockControls', () => {
    const out = texts(mount(CLIENTS))
    expect(out).toContain('Sync engine') // live project chip, never a mock
    expect(out).toContain('Start')
    expect(out).toContain('Pause')
    expect(out).toContain('Clock in')
  })

  it('EmptyCatalog_ShowsAnHonestNoProjectsHint', () => {
    expect(texts(mount([]))).toContain('No projects yet')
  })

  it('Start_BeginsTheSharedTimerAndFlipsToStop', () => {
    const r = mount(CLIENTS)
    const startBtn = r.root
      .findAll(n => n.props.accessibilityRole === 'button')
      .find(n =>
        n
          .findAll(x => typeof x.type === 'string')
          .flatMap(x => x.children)
          .includes('Start'),
      )
    expect(startBtn).toBeDefined()
    act(() => {
      startBtn?.props.onPress()
    })
    const out = texts(r)
    expect(out).toContain('Tracking') // running status line
    expect(out).toContain('Stop') // the button flipped
  })
})
