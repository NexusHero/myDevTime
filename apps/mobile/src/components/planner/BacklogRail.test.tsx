// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { Pressable, TextInput } from 'react-native'
import { TestQueryProvider } from '../../test/TestQueryProvider.js'

/**
 * Render tests (ADR-0027) for the backlog rail + fill-week container (REQ-073, ADR-0072 D2):
 * the rail is a layer — CLOSED by default, opened from its chip (ux-vision §2.7); items
 * render at estimate height with search; the violet chip appears ONLY for a real
 * `ai-proposal` refinement; "Fill my week" runs the pure `packWeek` over windows derived
 * from the real feeds and shows ghosts + the honest unplaced count; ONE confirm posts one
 * `add-blocks` proposal per affected day with provenance `planner-fill` through the
 * plan-apply seam; Dismiss posts NOTHING. `buildPackDays` is pinned directly too.
 */

vi.mock('../../config', () => ({ apiBaseUrl: 'https://api.test' }))

const applyPlanProposal = vi.fn()
const getProtectedTimes = vi.fn()
vi.mock('../../api/planApply.js', () => ({
  applyPlanProposal: (...args: unknown[]) => applyPlanProposal(...args) as unknown,
  getProtectedTimes: (...args: unknown[]) => getProtectedTimes(...args) as unknown,
}))

const getPlan = vi.fn()
vi.mock('../../api/planner.js', () => ({
  getPlan: (...args: unknown[]) => getPlan(...args) as unknown,
}))

const listOccurrences = vi.fn()
vi.mock('../../api/recurrence.js', () => ({
  listOccurrences: (...args: unknown[]) => listOccurrences(...args) as unknown,
}))

interface RailItem {
  id: string
  title: string
  estimateMin: number
  estimateSource: 'explicit' | 'default'
  priority: number
  origin: 'task' | 'issue'
  taskId?: string
}
const railState: {
  items: RailItem[]
  proposals: Record<string, unknown>
  refining: string[]
} = { items: [], proposals: {}, refining: [] }
const requestRefinement = vi.fn()
const acceptRefinement = vi.fn()
vi.mock('../../hooks/useBacklogRail.js', () => ({
  useBacklogRail: () => ({
    items: railState.items,
    proposals: railState.proposals,
    refining: railState.refining,
    loading: false,
    error: null,
    live: true,
    reload: vi.fn(),
    requestRefinement,
    acceptRefinement,
  }),
}))

// Imported after the mocks so the container sees the fakes.
const { PlannerBacklogRail, buildPackDays } = await import('./BacklogRail.js')
const { ThemeProvider } = await import('../../theme/ThemeProvider.js')

const WEEK = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24']

const ITEMS: RailItem[] = [
  {
    id: 'task:t-1',
    title: 'Fix login redirect',
    estimateMin: 120,
    estimateSource: 'explicit',
    priority: 1,
    origin: 'task',
    taskId: 't-1',
  },
  {
    id: 'task:t-2',
    title: 'Write import docs',
    estimateMin: 60,
    estimateSource: 'default',
    priority: 2,
    origin: 'task',
    taskId: 't-2',
  },
  {
    id: 'issue:github:gh#7',
    title: 'Rate limit the sync endpoint',
    estimateMin: 60,
    estimateSource: 'default',
    priority: 3,
    origin: 'issue',
  },
]

let renderer: TestRenderer.ReactTestRenderer

async function render(): Promise<void> {
  await act(async () => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <TestQueryProvider>
          <PlannerBacklogRail weekDates={WEEK} />
        </TestQueryProvider>
      </ThemeProvider>,
    )
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

function texts(): string {
  return renderer.root
    .findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children)
    .filter((c): c is string => typeof c === 'string')
    .join(' ')
}

async function press(label: string): Promise<void> {
  const target = renderer.root.findAllByType(Pressable).find(p => {
    const a11y = (p.props as { accessibilityLabel?: string }).accessibilityLabel
    if (typeof a11y === 'string' && a11y.includes(label)) return true
    return p
      .findAll(n => typeof n.type === 'string')
      .flatMap(n => n.children)
      .some(c => typeof c === 'string' && c.includes(label))
  })
  expect(target, `no pressable for "${label}"`).toBeDefined()
  await act(async () => {
    ;(target?.props as { onPress: () => void }).onPress()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

async function openRail(): Promise<void> {
  await render()
  await press('Backlog rail')
}

beforeEach(() => {
  railState.items = [...ITEMS]
  railState.proposals = {}
  railState.refining = []
  listOccurrences.mockResolvedValue([])
  getProtectedTimes.mockResolvedValue([])
  getPlan.mockResolvedValue(null)
  applyPlanProposal.mockImplementation((_base: string, proposal: { day: string }) =>
    Promise.resolve({ proposal: { ...proposal }, resultPlanId: `plan-${proposal.day}` }),
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('PlannerBacklogRail', () => {
  it('Rail_IsClosedByDefault_AndOpensFromTheChip', async () => {
    await render()
    expect(texts()).not.toContain('Fill my week')
    await press('Backlog rail')
    expect(texts()).toContain('Fill my week')
    expect(texts()).toContain('Fix login redirect')
  })

  it('Rail_RendersItemsAtEstimateHeight_WithTheVisible60MinDefault', async () => {
    await openRail()
    const row = renderer.root.findAll(
      n =>
        (n.props as { accessibilityLabel?: string }).accessibilityLabel ===
        'Backlog item: Fix login redirect',
    )[0]
    expect(row).toBeDefined()
    const style = (row?.props as { style?: { minHeight?: number } }).style
    // 120 min ≈ double the 60-min row height — the estimate IS the height.
    expect(style?.minHeight).toBe(88)
    expect(texts()).toContain('default 60 min')
  })

  it('Rail_Search_FiltersTheListWithoutTouchingTheData', async () => {
    await openRail()
    const input = renderer.root.findAllByType(TextInput)[0]
    expect(input).toBeDefined()
    await act(async () => {
      ;(input?.props as { onChangeText: (s: string) => void }).onChangeText('docs')
      await Promise.resolve()
    })
    expect(texts()).toContain('Write import docs')
    expect(texts()).not.toContain('Fix login redirect')
  })

  it('Rail_VioletProposalChip_AppearsOnlyForARealAiProposal', async () => {
    railState.proposals = {
      'task:t-2': {
        source: 'ai-proposal',
        charged: true,
        estimateMinutes: 90,
        rationale: '',
        baselineMin: 60,
        baselineMax: 180,
      },
      'issue:github:gh#7': {
        source: 'deterministic',
        charged: false,
        estimateMinutes: 60,
        rationale: '',
        baselineMin: 30,
        baselineMax: 120,
      },
    }
    await openRail()
    const all = texts()
    // The AI proposal is labelled as AI; the degrade is a neutral baseline, never violet AI.
    expect(all).toContain('AI proposal: 1:30 h')
    expect(all).toContain('Baseline: 1:00 h')
  })

  it('FillWeek_ShowsGhostsAndTheHonestUnplacedCount', async () => {
    railState.items = [
      ...ITEMS,
      {
        id: 'task:huge',
        title: 'Rewrite everything',
        estimateMin: 5000,
        estimateSource: 'explicit',
        priority: 4,
        origin: 'task',
        taskId: 't-huge',
      },
    ]
    await openRail()
    await press('Fill my week')
    const all = texts()
    expect(all).toContain('Proposed week')
    expect(all).toContain('Fix login redirect')
    // The unestimated items' 60-min defaults land as 1:00 h ghosts.
    expect(all).toContain('1:00 h')
    expect(all).toContain("1 doesn't fit this week")
    expect(applyPlanProposal).not.toHaveBeenCalled()
  })

  it('Confirm_PostsOneAddBlocksPerAffectedDay_WithPlannerFillProvenance', async () => {
    await openRail()
    await press('Fill my week')
    await press('Confirm plan')
    expect(applyPlanProposal).toHaveBeenCalled()
    const calls = applyPlanProposal.mock.calls as [string, Record<string, unknown>][]
    const days = new Set<string>()
    for (const [base, proposal] of calls) {
      expect(base).toBe('https://api.test')
      expect(proposal['kind']).toBe('add-blocks')
      expect(proposal['provenance']).toBe('planner-fill')
      expect(typeof proposal['day']).toBe('string')
      expect(days.has(proposal['day'] as string), 'one post per affected day').toBe(false)
      days.add(proposal['day'] as string)
      expect(Array.isArray(proposal['blocks'])).toBe(true)
      for (const block of proposal['blocks'] as { kind: string }[]) {
        expect(block.kind).toBe('focus')
      }
    }
    // 240 min of backlog on an empty 8h Monday → everything fits on ONE day.
    expect(days.size).toBe(1)
    // The task-backed block carries its taskId through the seam.
    const blocks = calls[0]?.[1]['blocks'] as { label: string; taskId?: string }[]
    expect(blocks.find(b => b.label === 'Fix login redirect')?.taskId).toBe('t-1')
    // The preview is consumed after booking.
    expect(texts()).not.toContain('Proposed week')
  })

  it('Dismiss_DropsThePreviewAndWritesNothing', async () => {
    await openRail()
    await press('Fill my week')
    expect(texts()).toContain('Proposed week')
    await press('Dismiss')
    expect(texts()).not.toContain('Proposed week')
    expect(applyPlanProposal).not.toHaveBeenCalled()
  })

  it('PlaceOne_TapToPlaceFallback_PacksExactlyThatItemThroughTheSamePath', async () => {
    await openRail()
    await press('Place: Write import docs')
    const all = texts()
    expect(all).toContain('Proposed week')
    expect(all).toContain('Write import docs')
    // Exactly ONE ghost — the placed item; the rest of the rail is untouched.
    const ghostLabels = renderer.root
      .findAll(n => {
        const a11y = (n.props as { accessibilityLabel?: string }).accessibilityLabel
        return typeof a11y === 'string' && a11y.startsWith('Ghost:')
      })
      .map(n => (n.props as { accessibilityLabel: string }).accessibilityLabel)
    expect(ghostLabels).toEqual(['Ghost: Write import docs 20.07. 08:00'])
    await press('Confirm plan')
    expect(applyPlanProposal).toHaveBeenCalledTimes(1)
    const [, proposal] = applyPlanProposal.mock.calls[0] as [string, Record<string, unknown>]
    expect((proposal['blocks'] as unknown[]).length).toBe(1)
  })
})

describe('buildPackDays', () => {
  it('PackDays_WindowsExcludeMeetingsShieldsAndTheStoredPlan', () => {
    const days = buildPackDays(
      ['2026-07-20'],
      [
        {
          seriesId: 's1',
          kind: 'meeting',
          title: 'Standup',
          date: '2026-07-20',
          startMin: 540,
          lenMin: 60,
          projectId: null,
          priority: null,
          note: null,
        },
      ],
      [[{ id: 'p1', day: '2026-07-20', startMin: 720, endMin: 780, source: 'sevi' }]],
      [
        {
          id: 'plan-1',
          date: '2026-07-20',
          version: 1,
          status: 'accepted',
          blocks: [{ startMin: 480, lenMin: 30, kind: 'focus', label: 'Early', taskId: null }],
          plannedFocusMin: 30,
          unplacedMin: 0,
          droppedAnchors: [],
        },
      ],
    )
    expect(days[0]?.windows).toEqual([
      { startMin: 510, endMin: 540 },
      { startMin: 600, endMin: 720 },
      { startMin: 780, endMin: 1080 },
    ])
    // Line: 480 target − 60 🛡 commitment − 30 already planned = 390.
    expect(days[0]?.capacityLineMin).toBe(390)
  })

  it('PackDays_LifeCommitmentsReduceTheLine_MeetingsDoNot', () => {
    const days = buildPackDays(
      ['2026-07-20'],
      [
        {
          seriesId: 's-life',
          kind: 'life',
          title: 'Family',
          date: '2026-07-20',
          startMin: 960,
          lenMin: 120,
          projectId: null,
          priority: null,
          note: null,
        },
        {
          seriesId: 's-meet',
          kind: 'meeting',
          title: 'Sync',
          date: '2026-07-20',
          startMin: 540,
          lenMin: 60,
          projectId: null,
          priority: null,
          note: null,
        },
      ],
      [[]],
      [null],
    )
    // Life reduces the personal line (480 − 120); the meeting only blocks its window.
    expect(days[0]?.capacityLineMin).toBe(360)
    expect(days[0]?.windows).toEqual([
      { startMin: 480, endMin: 540 },
      { startMin: 600, endMin: 960 },
    ])
  })
})
