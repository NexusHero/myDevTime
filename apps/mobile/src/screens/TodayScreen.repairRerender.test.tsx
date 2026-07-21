// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { ToastProvider } from '../components/core/Toast.js'
import { TimerProvider } from '../timer/TimerContext.js'
import { PomodoroProvider } from '../focus/PomodoroContext.js'
import { TestQueryProvider } from '../test/TestQueryProvider.js'

/**
 * One-tap day repair — the Co-Planner card must show the re-laid block's time IN PLACE after
 * Confirm, in the SAME `HH:MM–HH:MM` form the seam, the ghost preview and the acceptance test
 * use (REQ-072, ADR-0072 D1; mirrors `e2e/tests/planner-repair.spec.ts:97`). The real
 * `TodayScreen` runs over a fake plan API that serves an accepted plan, then the re-laid version
 * after the apply POST. The re-laid block ends on the day-frame edge (minute 1440), which the
 * shared `hhmm` convention (`% 24`, as in `useDayRepair` and the spec) renders `00:00` — the
 * card must agree, never `24:00`. Tapping Confirm applies through the seam, `usePlanner.refresh`
 * re-reads the new version, and the card re-renders with the matching label.
 */

vi.mock('../config', () => ({ apiBaseUrl: 'http://test.local' }))

// Peripheral review surfaces stay quiet — this test only exercises the Co-Planner card.
vi.mock('../hooks/useTodayEntries', () => ({
  useTodayEntries: () => ({
    data: [],
    loading: false,
    error: null,
    reload: () => undefined,
    live: false,
    booked: [],
    bookedMs: 0,
  }),
}))
vi.mock('./useCatalog', () => ({
  useCatalog: () => ({
    data: [],
    loading: false,
    error: null,
    reload: () => undefined,
    live: false,
  }),
}))

/** `HH:MM` with the shared day-frame wrap (`% 24`) — the seam/preview/spec convention. */
function hhmm(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}`
}

type Placement = { blockId: string; startMin: number; lenMin: number }

// nowMin = 23:00 → the missed hour re-lays to 23:00–24:00, whose end sits on the day-frame
// edge (minute 1440): the shared convention renders it `00:00`, so the label is `23:00–00:00`.
const NOW_MIN = 23 * 60
const V1_BLOCKS = [
  { startMin: NOW_MIN - 120, lenMin: 60, kind: 'focus', label: 'Deep work', taskId: null },
]

function applyPlacements(placements: readonly Placement[]): typeof V1_BLOCKS {
  return V1_BLOCKS.map((b, i) => {
    const p = placements.find(pl => pl.blockId === String(i))
    return p === undefined ? b : { ...b, startMin: p.startMin, lenMin: p.lenMin }
  })
}

let applied = false
let postedPlacements: Placement[] = []

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const fakeFetch = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
  const u = String(url)
  const method = init?.method ?? 'GET'
  if (u.includes('/api/planner/apply') && method === 'POST') {
    const body = JSON.parse(String(init?.body)) as { proposal: { placements: Placement[] } }
    postedPlacements = body.proposal.placements
    applied = true
    return jsonResponse({ applied: { proposal: body.proposal, resultPlanId: 'plan-2' } })
  }
  if (u.includes('/api/planner/plans/') && u.includes('/review')) {
    return jsonResponse({ plannedFocusMin: 60, trackedFocusMin: 0, driftMin: -120 })
  }
  if (u.includes('/api/planner/protected')) return jsonResponse([])
  if (u.includes('/api/planner/plans')) {
    return jsonResponse({
      id: applied ? 'plan-2' : 'plan-1',
      planDate: '2026-07-21',
      version: applied ? 2 : 1,
      status: 'accepted',
      blocks: applied ? applyPlacements(postedPlacements) : V1_BLOCKS,
      plannedFocusMin: 60,
      unplacedMin: 0,
      droppedAnchors: [],
    })
  }
  return jsonResponse([]) // any other probe → benign empty list (hooks degrade)
})

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

function press(r: TestRenderer.ReactTestRenderer, label: string): void {
  const node = r.root.findAll(n => n.props.accessibilityLabel === label)[0]
  expect(node, `expected a pressable labelled "${label}"`).toBeDefined()
  ;(node!.props.onPress as () => void)()
}

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 6, 21, 23, 0, 0)) // 23:00 local → nowMin = 1380
  applied = false
  postedPlacements = []
  vi.stubGlobal('fetch', fakeFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('TodayScreen · Co-Planner card re-renders after a one-tap repair (REQ-072)', () => {
  it('shows the re-laid block time in place, in the shared HH:MM–HH:MM form (matches the seam)', async () => {
    const { TodayScreen } = await import('./TodayScreen.js')
    let r!: TestRenderer.ReactTestRenderer
    await act(async () => {
      r = TestRenderer.create(
        <TestQueryProvider>
          <ThemeProvider>
            <ToastProvider>
              <TimerProvider>
                <PomodoroProvider>
                  <TodayScreen />
                </PomodoroProvider>
              </TimerProvider>
            </ToastProvider>
          </ThemeProvider>
        </TestQueryProvider>,
      )
    })
    await flush()
    await flush()

    // v1 on screen: Deep work in the past (21:00–22:00), and the repair is offered.
    let tree = JSON.stringify(r.toJSON())
    expect(tree).toContain('21:00–22:00')

    await act(async () => {
      press(r, 'Plan gerissen · Reparieren')
    })
    await flush()
    await act(async () => {
      press(r, 'Confirm repair')
    })
    // apply → seam POST → planner.refresh() → re-read v2 → card re-renders.
    await flush()
    await flush()
    await flush()

    // The label the acceptance test computes from the SERVER's re-laid block (spec L95).
    const repaired = applyPlacements(postedPlacements)[0]!
    const repairedTimeLabel = `${hhmm(repaired.startMin)}–${hhmm(repaired.startMin + repaired.lenMin)}`
    expect(repairedTimeLabel).toBe('23:00–00:00')

    tree = JSON.stringify(r.toJSON())
    // The card must render the moved hour in the same wrapped form — never `23:00–24:00`.
    expect(tree).toContain(repairedTimeLabel)
    expect(tree).not.toContain('23:00–24:00')
    r.unmount()
  })
})
