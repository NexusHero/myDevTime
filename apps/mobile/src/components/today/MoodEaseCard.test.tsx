// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import { Button } from '../index.js'
import type { DayPlan } from '../../api/planner.js'

/**
 * Render tests (ADR-0027) for the MoodEaseCard (REQ-068/070, ADR-0071). The api seams are
 * mocked so the tests pin the client contract: only a LOW mood stored for today PLUS a
 * persisted plan with a focus block yields the "make today lighter" proposal — the shrink of
 * the LARGEST focus block by 25 % is computed by code, shown with its provenance chip, and
 * applied EXACTLY ONCE on an explicit confirm. A good mood, a missing plan, or a dismiss all
 * yield nothing — Sevi proposes, never books (ADR-0005), and a dismissed day stays dismissed
 * for the session.
 */
const { getMoodHistory, getPlan, applyPlanProposal } = vi.hoisted(() => ({
  getMoodHistory: vi.fn(),
  getPlan: vi.fn(),
  applyPlanProposal: vi.fn(),
}))
vi.mock('../../api/mood.js', () => ({ getMoodHistory }))
vi.mock('../../api/planner.js', () => ({ getPlan }))
vi.mock('../../api/planApply.js', () => ({ applyPlanProposal }))

const { MoodEaseCard } = await import('./MoodEaseCard.js')

const BASE = 'https://api.test'

/** A stored plan whose LARGEST focus block sits at index 1 of the stored array. */
function planFor(date: string): DayPlan {
  return {
    id: 'plan-1',
    date,
    version: 1,
    status: 'accepted',
    blocks: [
      { startMin: 540, lenMin: 60, kind: 'focus', label: 'Deep work', taskId: null },
      { startMin: 660, lenMin: 90, kind: 'focus', label: 'Big feature', taskId: null },
      { startMin: 780, lenMin: 30, kind: 'meeting', label: 'Sync', taskId: null },
    ],
    plannedFocusMin: 150,
    unplacedMin: 0,
    droppedAnchors: [],
  }
}

async function render(date: string): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer
  await act(async () => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <MoodEaseCard baseUrl={BASE} date={date} />
      </ThemeProvider>,
    )
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return renderer
}

function button(r: TestRenderer.ReactTestRenderer, label: string): TestRenderer.ReactTestInstance {
  const b = r.root.findAllByType(Button).find(x => x.props.children === label)
  expect(b, label).toBeDefined()
  return b!
}

async function press(b: TestRenderer.ReactTestInstance): Promise<void> {
  await act(async () => {
    ;(b.props.onPress as () => void)()
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

describe('MoodEaseCard', () => {
  beforeEach(() => {
    // Each case sets its own seam behaviour; call counts must never leak across cases.
    getMoodHistory.mockReset()
    getPlan.mockReset()
    applyPlanProposal.mockReset()
  })

  it('LowMoodTodayWithAFocusPlan_ProposesMakingTodayLighter', async () => {
    const date = '2026-07-20'
    getMoodHistory.mockResolvedValueOnce([{ day: date, mood: 'stressed' }])
    getPlan.mockResolvedValueOnce(planFor(date))

    const r = await render(date)
    const out = JSON.stringify(r.toJSON())
    // The concrete, code-computed shrink: the LARGEST focus block (90 min) by 25 % → 23 min.
    expect(out).toContain('Make today lighter')
    expect(out).toContain('Big feature')
    expect(out).toContain('23 min')
    expect(out).toContain('Sevi proposal') // the provenance chip
    expect(out).toContain('Nothing changes until you confirm')
    expect(applyPlanProposal).not.toHaveBeenCalled()
  })

  it('ConfirmPressedTwice_AppliesExactlyOneShrinkProposal', async () => {
    const date = '2026-07-21'
    getMoodHistory.mockResolvedValueOnce([{ day: date, mood: 'tense' }])
    getPlan.mockResolvedValueOnce(planFor(date))
    applyPlanProposal.mockResolvedValue({
      proposal: { kind: 'shrink-block', planId: 'plan-1', blockId: '1', byMin: 23 },
      resultPlanId: 'plan-2',
    })

    const r = await render(date)
    // A double-tap: both presses land before the card can re-render — the busy/applied guard
    // must still let exactly ONE proposal through (the confirm row unmounts once applied).
    const onPress = button(r, 'Make today lighter').props.onPress as () => void
    await act(async () => {
      onPress()
      onPress()
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(applyPlanProposal).toHaveBeenCalledTimes(1)
    expect(applyPlanProposal).toHaveBeenCalledWith(BASE, {
      kind: 'shrink-block',
      planId: 'plan-1',
      blockId: '1',
      byMin: 23,
    })
    expect(JSON.stringify(r.toJSON())).toContain('lighter now')
  })

  it('GoodMoodToday_RendersNothing', async () => {
    const date = '2026-07-22'
    getMoodHistory.mockResolvedValueOnce([{ day: date, mood: 'good' }])
    getPlan.mockResolvedValueOnce(planFor(date))

    const r = await render(date)
    expect(r.toJSON()).toBeNull()
  })

  it('NoPlanForToday_RendersNothing', async () => {
    const date = '2026-07-23'
    getMoodHistory.mockResolvedValueOnce([{ day: date, mood: 'stressed' }])
    getPlan.mockResolvedValueOnce(null)

    const r = await render(date)
    expect(r.toJSON()).toBeNull()
  })

  it('PlanWithoutAFocusBlock_RendersNothing', async () => {
    const date = '2026-07-24'
    getMoodHistory.mockResolvedValueOnce([{ day: date, mood: 'stressed' }])
    const plan = planFor(date)
    getPlan.mockResolvedValueOnce({
      ...plan,
      blocks: plan.blocks.filter(b => b.kind === 'meeting'),
    })

    const r = await render(date)
    expect(r.toJSON()).toBeNull()
  })

  it('Dismiss_MakesNoCall_AndTheDayStaysDismissedForTheSession', async () => {
    const date = '2026-07-25'
    getMoodHistory.mockResolvedValue([{ day: date, mood: 'stressed' }])
    getPlan.mockResolvedValue(planFor(date))

    const r = await render(date)
    await press(button(r, 'Not today'))
    expect(r.toJSON()).toBeNull()
    expect(applyPlanProposal).not.toHaveBeenCalled()

    // A fresh mount of the same day stays quiet — the dismissal is session-remembered.
    const again = await render(date)
    expect(again.toJSON()).toBeNull()
  })
})
