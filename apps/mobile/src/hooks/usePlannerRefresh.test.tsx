// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'

/**
 * `usePlanner.refresh` is the in-place re-read the plan-apply seam calls after writing a new
 * plan version — the one-tap day repair (ADR-0072 D1, REQ-072). This pins the contract the
 * browser-acceptance journey (`e2e/tests/planner-repair.spec.ts:97`) depends on: after the
 * confirmed relayout the composed plan resource flips to the re-laid version **without a full
 * reload**, so the Co-Planner card repaints in place. Both real hooks run against a stubbed
 * global `fetch` (no `getPlan`/seam mock) so the whole refresh path is exercised end to end.
 */

vi.mock('../config.js', () => ({ apiBaseUrl: 'https://api.test' }))

const { usePlanner } = await import('./usePlanner.js')
const { useDayRepair } = await import('./useDayRepair.js')

interface Wire {
  id: string
  planDate: string
  version: number
  status: string
  blocks: { startMin: number; lenMin: number; kind: string; label: string; taskId: null }[]
  plannedFocusMin: number
  unplacedMin: number
  droppedAnchors: never[]
}

function planWire(version: number, deepWorkStart: number): Wire {
  return {
    id: `plan-${String(version)}`,
    planDate: '2026-07-21',
    version,
    status: 'accepted',
    blocks: [
      { startMin: deepWorkStart, lenMin: 60, kind: 'focus', label: 'Deep work', taskId: null },
      { startMin: 750, lenMin: 60, kind: 'focus', label: 'Docs', taskId: null },
      { startMin: 840, lenMin: 60, kind: 'focus', label: 'Review', taskId: null },
    ],
    plannedFocusMin: 180,
    unplacedMin: 0,
    droppedAnchors: [],
  }
}

// Server truth: v1's Deep work sits missed at 09:00 (540); the applied relayout re-lays it into
// the present (12:00 = 720) as a NEW accepted version — exactly what getLatestPlan returns next.
let current: Wire = planWire(1, 540)

function jsonRes(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function fetchStub(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method === 'GET' && url.includes('/api/planner/plans?date='))
    return Promise.resolve(jsonRes(current))
  if (method === 'GET' && url.includes('/review'))
    return Promise.resolve(jsonRes({ plannedFocusMin: 180, trackedFocusMin: 0, driftMin: -120 }))
  if (method === 'GET' && url.includes('/api/planner/protected'))
    return Promise.resolve(jsonRes([]))
  if (method === 'POST' && url.includes('/api/planner/apply')) {
    current = planWire(2, 720) // the seam persisted the re-laid remainder as v2
    return Promise.resolve(
      jsonRes({
        applied: {
          proposal: {
            kind: 'relayout-day',
            planId: 'plan-1',
            placements: [
              { blockId: '0', startMin: 720, lenMin: 60 },
              { blockId: '1', startMin: 780, lenMin: 60 },
              { blockId: '2', startMin: 840, lenMin: 60 },
            ],
            provenance: 'planner-reflow',
          },
          resultPlanId: 'plan-2',
        },
      }),
    )
  }
  return Promise.resolve(jsonRes(null))
}

type Snap = { version: number | null; deepWork: string | undefined; hasProposal: boolean }
let snap: Snap
let applyFn: () => void
function Probe(): null {
  const planner = usePlanner()
  const repair = useDayRepair(planner)
  const dw = planner.plan?.blocks.find(b => b.label === 'Deep work')
  const hhmm = (m: number): string => {
    const h = Math.floor(m / 60) % 24
    const mm = m % 60
    const p = (n: number): string => String(n).padStart(2, '0')
    return `${p(h)}:${p(mm)}`
  }
  snap = {
    version: planner.plan?.version ?? null,
    deepWork: dw ? `${hhmm(dw.startMin)}–${hhmm(dw.startMin + dw.lenMin)}` : undefined,
    hasProposal: repair.proposal !== null,
  }
  applyFn = repair.apply
  return null
}

async function flush(): Promise<void> {
  for (let i = 0; i < 12; i++)
    await act(async () => {
      await Promise.resolve()
    })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 6, 21, 12, 0, 0)) // 12:00 local → nowMin 720
  current = planWire(1, 540)
  vi.stubGlobal('fetch', vi.fn(fetchStub))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('usePlanner.refresh · in-place re-read after one-tap repair', () => {
  it('Repair_ReplacesThePlanInPlace_WithoutAReload', async () => {
    let r!: TestRenderer.ReactTestRenderer
    await act(async () => {
      r = TestRenderer.create(<Probe />)
    })
    await flush()
    // v1 loaded with the missed Deep work, and the pure core offers a repair.
    expect(snap.version).toBe(1)
    expect(snap.deepWork).toBe('09:00–10:00')
    expect(snap.hasProposal).toBe(true)

    await act(async () => {
      applyFn()
    })
    await flush()

    // The Co-Planner card reads planner.plan: after the seam apply + in-place refresh it is v2,
    // with the re-laid time — no full remount required.
    expect(snap.version).toBe(2)
    expect(snap.deepWork).toBe('12:00–13:00')
    r.unmount()
  })
})
