// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'

/**
 * `useDayRepair` (ADR-0072 D1, REQ-072): the composition of the pure `reflowDay` core with the
 * plan resource, today's 🛡 windows and the plan-apply seam. Pinned here: the repair derives
 * from the SAME drift signal as Today's drift chip (review drift ≤ −30) plus fully-passed
 * focus blocks; the seam call carries `relayout-day` + provenance `planner-reflow`; accepting
 * a stretch records the day-scoped acknowledgment while a fitting repair records nothing; and
 * dismiss changes NOTHING (no request, ever).
 */

const seams = vi.hoisted(() => ({
  applyPlanProposal: vi.fn(),
  getProtectedTimes: vi.fn(),
}))

vi.mock('../config.js', () => ({ apiBaseUrl: 'https://api.test' }))
vi.mock('../api/planApply.js', () => ({
  applyPlanProposal: (...args: unknown[]) => seams.applyPlanProposal(...args) as unknown,
  getProtectedTimes: (...args: unknown[]) => seams.getProtectedTimes(...args) as unknown,
}))

const { useDayRepair } = await import('./useDayRepair.js')
const { stretchAckActive, resetStretchAck } = await import('../sevi/stretchAck.js')
import type { PlannerResource } from './usePlanner.js'
import type { DayPlan, PlanReview } from '../api/planner.js'

type Resource = ReturnType<typeof useDayRepair>

function block(
  startMin: number,
  lenMin: number,
  label: string,
  kind: 'meeting' | 'focus' | 'break' = 'focus',
): DayPlan['blocks'][number] {
  return { startMin, lenMin, kind, label, taskId: null }
}

function makePlanner(
  blocks: DayPlan['blocks'],
  overrides: { driftMin?: number; status?: string; live?: boolean } = {},
): PlannerResource {
  const plan: DayPlan = {
    id: 'plan-1',
    date: '2026-07-21',
    version: 3,
    status: overrides.status ?? 'accepted',
    blocks,
    plannedFocusMin: blocks.filter(b => b.kind === 'focus').reduce((s, b) => s + b.lenMin, 0),
    unplacedMin: 0,
    droppedAnchors: [],
  }
  const review: PlanReview = {
    plannedFocusMin: plan.plannedFocusMin,
    trackedFocusMin: 0,
    driftMin: overrides.driftMin ?? -plan.plannedFocusMin,
  }
  return {
    plan,
    review,
    loading: false,
    error: null,
    live: overrides.live ?? true,
    busy: false,
    dayStartMin: 480,
    dayEndMin: 1080,
    repropose: vi.fn(),
    accept: vi.fn(),
    briefing: null,
    briefingBusy: false,
    requestBriefing: vi.fn(),
    refresh: vi.fn(),
  }
}

let latest: Resource
function Probe({ planner }: { planner: PlannerResource }): null {
  latest = useDayRepair(planner)
  return null
}

async function renderProbe(planner: PlannerResource): Promise<TestRenderer.ReactTestRenderer> {
  let r!: TestRenderer.ReactTestRenderer
  await act(async () => {
    r = TestRenderer.create(<Probe planner={planner} />)
    await Promise.resolve()
  })
  return r
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 6, 21, 12, 0, 0)) // 12:00 local → nowMin = 720
  resetStretchAck()
  seams.getProtectedTimes.mockResolvedValue([])
  seams.applyPlanProposal.mockResolvedValue({
    applied: { proposal: { kind: 'relayout-day' } },
  })
})

afterEach(() => {
  resetStretchAck()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('useDayRepair · derivation', () => {
  it('BehindPlanWithMissedBlock_ProposesTheReflowedRemainder', async () => {
    // 09:00–10:00 missed; 12:30 and 14:00 upcoming → the pure core cascades a@12:00, b@13:00.
    const r = await renderProbe(
      makePlanner([block(540, 60, 'Deep work'), block(750, 60, 'Docs'), block(840, 60, 'Review')]),
    )
    expect(latest.proposal).not.toBeNull()
    expect(latest.placements).toEqual([
      { id: '0', label: 'Deep work', startMin: 720, lenMin: 60, timeLabel: '12:00–13:00' },
      { id: '1', label: 'Docs', startMin: 780, lenMin: 60, timeLabel: '13:00–14:00' },
      { id: '2', label: 'Review', startMin: 840, lenMin: 60, timeLabel: '14:00–15:00' },
    ])
    expect(latest.proposal?.overflow).toEqual({ kind: 'fits' })
    expect(latest.price).toBeNull()
    r.unmount()
  })

  it('NotMateriallyBehindPlan_NoRepair', async () => {
    const r = await renderProbe(
      makePlanner([block(540, 60, 'Deep work'), block(750, 60, 'Docs')], { driftMin: -29 }),
    )
    expect(latest.proposal).toBeNull()
    r.unmount()
  })

  it('BehindPlanButNothingMissedYet_NoRepair', async () => {
    // Drifted, but every block window still lies ahead — nothing to re-lay.
    const r = await renderProbe(
      makePlanner([block(750, 60, 'Docs'), block(840, 60, 'Review')], { driftMin: -60 }),
    )
    expect(latest.proposal).toBeNull()
    r.unmount()
  })

  it('PlanNotAccepted_NoRepair', async () => {
    const r = await renderProbe(
      makePlanner([block(540, 60, 'Deep work'), block(750, 60, 'Docs')], { status: 'proposed' }),
    )
    expect(latest.proposal).toBeNull()
    r.unmount()
  })

  it('StretchDay_CarriesTheIssueFixedPriceLine_BeforeAnyTap', async () => {
    // No gaps ahead: the missed hour can only land past the plan's own end (14:00 line).
    const r = await renderProbe(
      makePlanner([block(540, 60, 'Deep work'), block(720, 60, 'Docs'), block(780, 60, 'Review')]),
    )
    expect(latest.proposal?.overflow).toEqual({
      kind: 'stretch',
      overLineMin: 60,
      projectedEndMin: 900,
    })
    expect(latest.price).toBe('+60 min über deiner Linie · Feierabend ~15:00')
    expect(seams.applyPlanProposal).not.toHaveBeenCalled()
    r.unmount()
  })

  it('ProtectedWindow_IsAFixedObstacle_TheRepairFlowsAround', async () => {
    seams.getProtectedTimes.mockResolvedValue([
      { id: 'pt', day: '2026-07-21', startMin: 700, endMin: 765, source: 'sevi' },
    ])
    const r = await renderProbe(makePlanner([block(540, 60, 'Deep work')]))
    expect(latest.placements).toEqual([
      { id: '0', label: 'Deep work', startMin: 765, lenMin: 60, timeLabel: '12:45–13:45' },
    ])
    r.unmount()
  })

  it('MovedOverflow_NamesTheBlocksThatLeaveTheDay', async () => {
    // Frame 09:00 + 10:45 cap = 19:45; fill the remainder so one block cannot fit.
    const r = await renderProbe(
      makePlanner([
        block(540, 60, 'Missed A'),
        block(600, 60, 'Missed B'),
        block(720, 240, 'Long haul'),
        block(960, 180, 'Late run'),
      ]),
    )
    expect(latest.proposal?.overflow.kind).toBe('moved')
    expect(latest.movedLabels).toEqual(['Late run'])
    r.unmount()
  })
})

describe('useDayRepair · apply and dismiss', () => {
  it('Apply_PostsExactlyOneRelayoutThroughTheSeam_AndRefreshesThePlan', async () => {
    const planner = makePlanner([
      block(540, 60, 'Deep work'),
      block(750, 60, 'Docs'),
      block(840, 60, 'Review'),
    ])
    const r = await renderProbe(planner)
    await act(async () => {
      latest.openPreview()
      await Promise.resolve()
    })
    expect(latest.previewOpen).toBe(true)
    await act(async () => {
      latest.apply()
      await Promise.resolve()
    })
    expect(seams.applyPlanProposal).toHaveBeenCalledExactlyOnceWith('https://api.test', {
      kind: 'relayout-day',
      planId: 'plan-1',
      placements: [
        { blockId: '0', startMin: 720, lenMin: 60 },
        { blockId: '1', startMin: 780, lenMin: 60 },
        { blockId: '2', startMin: 840, lenMin: 60 },
      ],
      provenance: 'planner-reflow',
    })
    expect(planner.refresh).toHaveBeenCalledTimes(1)
    expect(latest.previewOpen).toBe(false)
    // A repair that FITS records no stretch acknowledgment — nothing was chosen over the line.
    expect(stretchAckActive(Date.now())).toBe(false)
    r.unmount()
  })

  it('ApplyStretch_RecordsTheDayScopedAcknowledgment', async () => {
    const r = await renderProbe(
      makePlanner([block(540, 60, 'Deep work'), block(720, 60, 'Docs'), block(780, 60, 'Review')]),
    )
    expect(latest.price).not.toBeNull() // the deal is priced before the tap
    await act(async () => {
      latest.apply()
      await Promise.resolve()
    })
    expect(seams.applyPlanProposal).toHaveBeenCalledTimes(1)
    expect(stretchAckActive(Date.now())).toBe(true)
    r.unmount()
  })

  it('Dismiss_ChangesNothing_NoRequestNoAck', async () => {
    const r = await renderProbe(
      makePlanner([block(540, 60, 'Deep work'), block(750, 60, 'Docs'), block(840, 60, 'Review')]),
    )
    await act(async () => {
      latest.openPreview()
      await Promise.resolve()
    })
    await act(async () => {
      latest.dismiss()
      await Promise.resolve()
    })
    expect(latest.previewOpen).toBe(false)
    expect(latest.proposal).not.toBeNull() // the proposal is still there — only the preview closed
    expect(seams.applyPlanProposal).not.toHaveBeenCalled()
    expect(stretchAckActive(Date.now())).toBe(false)
    r.unmount()
  })

  it('ApplyFails_SurfacesTheErrorAndKeepsThePreviewOpen', async () => {
    seams.applyPlanProposal.mockRejectedValue(new Error('offline'))
    const r = await renderProbe(
      makePlanner([block(540, 60, 'Deep work'), block(750, 60, 'Docs'), block(840, 60, 'Review')]),
    )
    await act(async () => {
      latest.openPreview()
      await Promise.resolve()
    })
    await act(async () => {
      latest.apply()
      await Promise.resolve()
    })
    expect(latest.error?.message).toBe('offline')
    expect(latest.previewOpen).toBe(true)
    expect(stretchAckActive(Date.now())).toBe(false)
    r.unmount()
  })
})
