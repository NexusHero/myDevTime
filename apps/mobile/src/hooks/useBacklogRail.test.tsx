// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { TestQueryProvider } from '../test/TestQueryProvider.js'

/**
 * `useBacklogRail` (REQ-073, ADR-0072 D2): the rail assembles from the two REAL backlog
 * feeds — open workspace tasks (stable catalog order) then connected issues connectors'
 * import previews — with the deterministic 60-minute default for anything unestimated and a
 * 1-based stable priority. The AI refinement (REQ-041) is proposal-only: request stores a
 * reviewable proposal, accept persists via the ordinary estimate PATCH (tasks) or a local
 * override (issue proposals, which own no task row), and a dead provider/connector leaves
 * the rail fully working on defaults (ADR-0005 degrade).
 */

vi.mock('../config', () => ({ apiBaseUrl: 'https://api.test' }))

const getJson = vi.fn()
const postJson = vi.fn()
const patchJson = vi.fn()
vi.mock('../api/http.js', () => ({
  getJson: (...args: unknown[]) => getJson(...args) as unknown,
  postJson: (...args: unknown[]) => postJson(...args) as unknown,
  patchJson: (...args: unknown[]) => patchJson(...args) as unknown,
  deleteJson: vi.fn(),
}))

// Imported after the mocks so the hook (and the real api parsers it uses) see the fakes.
const { useBacklogRail, DEFAULT_ESTIMATE_MIN } = await import('./useBacklogRail.js')
type RailResource = ReturnType<typeof useBacklogRail>

const TASK_ROWS = [
  {
    id: 't-1',
    name: 'Fix login redirect',
    projectId: 'p-1',
    archived: false,
    category: 'bug',
    complexity: 'small',
    estimateMinutes: 120,
  },
  {
    id: 't-2',
    name: 'Write import docs',
    projectId: 'p-1',
    archived: false,
    category: null,
    complexity: null,
    estimateMinutes: null,
  },
  {
    id: 't-3',
    name: 'Archived old task',
    projectId: 'p-1',
    archived: true,
    category: null,
    complexity: null,
    estimateMinutes: null,
  },
]

const CONNECTORS = [
  { id: 'github', label: 'GitHub', category: 'issues', configured: true, connected: true },
  { id: 'slack', label: 'Slack', category: 'chat', configured: true, connected: true },
]

const PREVIEW = {
  status: 'ok',
  proposals: [
    {
      externalKey: 'gh#7',
      source: 'github',
      title: 'Rate limit the sync endpoint',
      provenance: 'import:github',
      confirmed: false,
      labels: [],
      url: 'https://example.test/7',
    },
  ],
}

/** Route the mocked GET by path — the hook talks to the same real endpoints the app uses. */
function routeGets(opts: { previewFails?: boolean } = {}): void {
  getJson.mockImplementation((_base: string, path: string) => {
    if (path === '/api/tracking/tasks') return Promise.resolve(TASK_ROWS)
    if (path === '/api/connectors') return Promise.resolve(CONNECTORS)
    if (path.startsWith('/api/connectors/github/issues/preview')) {
      return opts.previewFails === true
        ? Promise.reject(new Error('409 no consent'))
        : Promise.resolve(PREVIEW)
    }
    return Promise.reject(new Error(`unexpected GET ${path}`))
  })
}

const result: { state: RailResource | null } = { state: null }

function Probe(): null {
  result.state = useBacklogRail()
  return null
}

async function renderProbe(): Promise<void> {
  await act(async () => {
    TestRenderer.create(
      <TestQueryProvider>
        <Probe />
      </TestQueryProvider>,
    )
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

/** Flush one more microtask/effect round after driving a callback. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  result.state = null
  routeGets()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useBacklogRail', () => {
  it('Rail_AssemblesOpenTasksThenImportedIssues_WithStablePriorities', async () => {
    await renderProbe()
    const items = result.state?.items ?? []
    expect(items.map(i => i.id)).toEqual(['task:t-1', 'task:t-2', 'issue:github:gh#7'])
    expect(items.map(i => i.priority)).toEqual([1, 2, 3])
    expect(items.map(i => i.origin)).toEqual(['task', 'task', 'issue'])
    // The archived task never reaches the rail.
    expect(items.some(i => i.title === 'Archived old task')).toBe(false)
  })

  it('Rail_ExplicitEstimateWins_UnestimatedGetsTheDeterministic60MinDefault', async () => {
    await renderProbe()
    const [estimated, unestimated, issue] = result.state?.items ?? []
    expect(estimated?.estimateMin).toBe(120)
    expect(estimated?.estimateSource).toBe('explicit')
    expect(unestimated?.estimateMin).toBe(DEFAULT_ESTIMATE_MIN)
    expect(unestimated?.estimateSource).toBe('default')
    expect(issue?.estimateMin).toBe(DEFAULT_ESTIMATE_MIN)
    expect(issue?.estimateSource).toBe('default')
  })

  it('Rail_ARefusingIssueConnector_LeavesTheTaskRailFullyWorking', async () => {
    routeGets({ previewFails: true })
    await renderProbe()
    const items = result.state?.items ?? []
    expect(items.map(i => i.id)).toEqual(['task:t-1', 'task:t-2'])
    expect(result.state?.error).toBeNull()
  })

  it('Refinement_RequestStoresAReviewableProposal_NothingIsAppliedByItself', async () => {
    postJson.mockResolvedValue({
      source: 'ai-proposal',
      charged: true,
      estimateMinutes: 90,
      rationale: 'similar bugs took ~1.5h',
      baselineMin: 60,
      baselineMax: 180,
    })
    await renderProbe()
    const item = result.state?.items[1]
    expect(item).toBeDefined()
    if (!item) return
    await act(async () => {
      result.state?.requestRefinement(item)
    })
    await flush()
    expect(postJson).toHaveBeenCalledWith(
      'https://api.test',
      '/api/ai/estimate',
      expect.objectContaining({ note: item.title }),
      expect.any(Function),
    )
    expect(result.state?.proposals[item.id]?.estimateMinutes).toBe(90)
    expect(result.state?.proposals[item.id]?.source).toBe('ai-proposal')
    // The item itself still packs at the default — the proposal changed nothing on its own.
    expect(result.state?.items[1]?.estimateMin).toBe(DEFAULT_ESTIMATE_MIN)
    expect(patchJson).not.toHaveBeenCalled()
  })

  it('Refinement_ProviderDownDegradesToDeterministic_NeverDressedUpAsAi', async () => {
    postJson.mockResolvedValue({
      source: 'deterministic',
      charged: false,
      estimateMinutes: 60,
      rationale: '',
      baselineMin: 30,
      baselineMax: 120,
    })
    await renderProbe()
    const item = result.state?.items[1]
    if (!item) throw new Error('missing item')
    await act(async () => {
      result.state?.requestRefinement(item)
    })
    await flush()
    expect(result.state?.proposals[item.id]?.source).toBe('deterministic')
    expect(result.state?.proposals[item.id]?.charged).toBe(false)
  })

  it('Refinement_AcceptOnATask_PersistsViaTheOrdinaryEstimatePatchAndReloads', async () => {
    postJson.mockResolvedValue({
      source: 'ai-proposal',
      charged: true,
      estimateMinutes: 45,
      rationale: '',
      baselineMin: 30,
      baselineMax: 120,
    })
    patchJson.mockResolvedValue({ ...TASK_ROWS[1], estimateMinutes: 45 })
    await renderProbe()
    const item = result.state?.items[1]
    if (!item) throw new Error('missing item')
    await act(async () => {
      result.state?.requestRefinement(item)
    })
    await flush()
    await act(async () => {
      result.state?.acceptRefinement(item)
    })
    await flush()
    expect(patchJson).toHaveBeenCalledWith(
      'https://api.test',
      '/api/tracking/tasks/t-2',
      { estimateMinutes: 45 },
      expect.any(Function),
    )
    // The accepted proposal is consumed — no violet chip lingers.
    expect(result.state?.proposals[item.id]).toBeUndefined()
  })

  it('Refinement_AcceptOnAnIssueProposal_ResolvesLocallyLikeAnExplicitEstimate', async () => {
    postJson.mockResolvedValue({
      source: 'ai-proposal',
      charged: true,
      estimateMinutes: 30,
      rationale: '',
      baselineMin: 30,
      baselineMax: 120,
    })
    await renderProbe()
    const issue = result.state?.items[2]
    if (!issue) throw new Error('missing issue item')
    await act(async () => {
      result.state?.requestRefinement(issue)
    })
    await flush()
    await act(async () => {
      result.state?.acceptRefinement(issue)
    })
    await flush()
    expect(patchJson).not.toHaveBeenCalled()
    const refreshed = result.state?.items[2]
    expect(refreshed?.estimateMin).toBe(30)
    expect(refreshed?.estimateSource).toBe('explicit')
    expect(result.state?.proposals[issue.id]).toBeUndefined()
  })
})
