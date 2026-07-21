// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import { ToastProvider } from '../core/Toast.js'
import { Button } from '../core/Button.js'
import type { Occurrence } from '../../api/recurrence.js'

/**
 * Render tests (ADR-0027) for Sevi's Scrum-Master banner (REQ-070). The plan-apply seam and
 * the planner reads are mocked so the tests pin the CLIENT contract: an over-committed week
 * shows ONE banner whose accessible title carries the overage figure; picking a relief
 * candidate only ARMS it (zero API calls); only the explicit Confirm routes exactly one
 * proposal through `applyPlanProposal`; a fitting week renders nothing at all.
 */
const { applyPlanProposal, getProtectedTimes, getPlan } = vi.hoisted(() => ({
  applyPlanProposal: vi.fn(),
  getProtectedTimes: vi.fn(),
  getPlan: vi.fn(),
}))
vi.mock('../../api/planApply.js', () => ({ applyPlanProposal, getProtectedTimes }))
vi.mock('../../api/planner.js', () => ({ getPlan }))
// The seam only fires against a configured backend; the hook must see one in the test.
vi.mock('../../config.js', () => ({ apiBaseUrl: 'https://api.test' }))

const { SeviAdvisory } = await import('./SeviAdvisory.js')

const WEEK_DATES = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24'] as const

/** One 10 h focus occurrence per weekday → 50 h planned on a 40 h week = +10 h over. */
const OVER_OCCURRENCES: Occurrence[] = WEEK_DATES.map(date => ({
  seriesId: `s-${date}`,
  kind: 'focus',
  title: 'Deep work',
  date,
  startMin: 9 * 60,
  lenMin: 10 * 60,
  projectId: null,
  priority: null,
  note: null,
}))

async function render(node: React.ReactElement): Promise<TestRenderer.ReactTestRenderer> {
  let r!: TestRenderer.ReactTestRenderer
  await act(async () => {
    r = TestRenderer.create(
      <ThemeProvider>
        <ToastProvider>{node}</ToastProvider>
      </ThemeProvider>,
    )
  })
  return r
}
function buttons(r: TestRenderer.ReactTestRenderer): readonly string[] {
  return r.root.findAllByType(Button).map(b => String(b.props.children))
}
function button(r: TestRenderer.ReactTestRenderer, label: string): TestRenderer.ReactTestInstance {
  const b = r.root.findAllByType(Button).find(x => x.props.children === label)
  expect(b, `button "${label}" (have: ${buttons(r).join(' | ')})`).toBeDefined()
  return b!
}
async function press(b: TestRenderer.ReactTestInstance): Promise<void> {
  await act(async () => {
    ;(b.props.onPress as () => void)()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getProtectedTimes.mockResolvedValue([])
  getPlan.mockResolvedValue(null)
  applyPlanProposal.mockResolvedValue({ proposal: { kind: 'protect-time' } })
})

describe('SeviAdvisory', () => {
  it('OvercommittedWeek_ShowsBannerWithOverageFigure', async () => {
    const r = await render(
      <SeviAdvisory blocks={[]} weekDates={[...WEEK_DATES]} occurrences={OVER_OCCURRENCES} />,
    )
    // The figure is the banner title → part of the accessible name (ContextBanner a11y).
    expect(JSON.stringify(r.toJSON())).toContain('Only 40.0 h plannable, 50.0 h planned — +10.0 h')
  })

  it('FittingWeek_RendersNothingAtAll', async () => {
    const r = await render(
      <SeviAdvisory blocks={[]} weekDates={[...WEEK_DATES]} occurrences={[]} />,
    )
    expect(r.toJSON()).toBeNull()
  })

  it('ReliefCandidateWithoutConfirm_MakesZeroApiCalls', async () => {
    const r = await render(
      <SeviAdvisory blocks={[]} weekDates={[...WEEK_DATES]} occurrences={OVER_OCCURRENCES} />,
    )
    await press(button(r, 'Protect "Deep work"'))
    // Armed, not applied: the Confirm step is now offered but nothing has mutated.
    expect(button(r, 'Confirm')).toBeDefined()
    expect(applyPlanProposal).not.toHaveBeenCalled()
  })

  it('ConfirmedRelief_RoutesExactlyOneProposalThroughTheSeam', async () => {
    const r = await render(
      <SeviAdvisory blocks={[]} weekDates={[...WEEK_DATES]} occurrences={OVER_OCCURRENCES} />,
    )
    await press(button(r, 'Protect "Deep work"'))
    await press(button(r, 'Confirm'))
    expect(applyPlanProposal).toHaveBeenCalledTimes(1)
    // The honest fallback mapping: a protect-time window over the occurrence's exact slot
    // (largest-movable relief, ties by index → Monday's block).
    expect(applyPlanProposal).toHaveBeenCalledWith('https://api.test', {
      kind: 'protect-time',
      day: '2026-07-20',
      startMin: 9 * 60,
      endMin: 19 * 60,
    })
  })

  it('Dismiss_HidesTheBanner_AndNeverCallsTheSeam', async () => {
    const r = await render(
      <SeviAdvisory blocks={[]} weekDates={[...WEEK_DATES]} occurrences={OVER_OCCURRENCES} />,
    )
    await press(button(r, 'Later'))
    expect(r.toJSON()).toBeNull()
    expect(applyPlanProposal).not.toHaveBeenCalled()
  })
})
