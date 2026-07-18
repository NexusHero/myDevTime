import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PlannerStartPicker } from './PlannerStartPicker.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import { ToastProvider } from '../core/Toast.js'
import { TimerProvider } from '../../timer/TimerContext.js'
import type { Client } from '../../screens/projectsData.js'

/**
 * Render tests (ADR-0027) for the Planner in-bar start-picker (design v20). It drives the shared
 * timer via `TimerProvider` (demo mode under the gate — no API — so start/stop resolve locally)
 * and confirms through `ToastProvider`, so it renders inside both.
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
            <PlannerStartPicker clients={clients} />
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

describe('PlannerStartPicker', () => {
  it('Idle_ListsLiveProjectsWithAStartButton', () => {
    const r = mount(CLIENTS)
    const out = texts(r)
    expect(out).toContain('Sync engine') // a real catalog project, never a mock
    expect(out).toContain('Start timer')
  })

  it('SelectProject_RevealsItsTasks', () => {
    const r = mount(CLIENTS)
    const chip = r.root
      .findAll(n => n.props.accessibilityRole === 'button')
      .find(n => n.props.accessibilityLabel === 'Sync engine')
    expect(chip).toBeDefined()
    act(() => {
      chip?.props.onPress()
    })
    expect(texts(r)).toContain('Conflict resolution') // the selected project's task
  })

  it('EmptyCatalog_ShowsAnHonestNoProjectsHint', () => {
    const out = texts(mount([]))
    expect(out).toContain('No projects yet')
  })

  it('Start_BeginsTheSharedTimerAndCollapsesToAStopStatus', () => {
    const r = mount(CLIENTS)
    // The Start button is the pressable whose rendered label is "Start timer".
    const pressStart = r.root
      .findAll(n => n.props.accessibilityRole === 'button')
      .find(n =>
        n
          .findAll(x => typeof x.type === 'string')
          .flatMap(x => x.children)
          .includes('Start timer'),
      )
    expect(pressStart).toBeDefined()
    act(() => {
      pressStart?.props.onPress()
    })
    // Demo timer starts immediately → the picker collapses to the running status + Stop.
    expect(texts(r)).toContain('Stop')
  })
})
