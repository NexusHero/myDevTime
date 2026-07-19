// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import { Button } from '../index.js'

/**
 * Render tests (ADR-0027) for the AI task-estimate review (REQ-041). The estimate api is mocked so
 * the test pins the CLIENT contract: the card starts as a single "AI estimate" button; an
 * `ai-proposal` response renders the estimate, its rationale and an "AI proposal" chip that owns up
 * to the spent credit, with Apply handing the minutes to the caller; a `deterministic` response is
 * rendered as a FREE baseline — never as an AI estimate, never claiming a charge (ADR-0005).
 */
const { requestEstimate } = vi.hoisted(() => ({
  requestEstimate: vi.fn(),
}))
vi.mock('../../api/estimate.js', () => ({ requestEstimate }))

const { TaskAiEstimateCard } = await import('./TaskAiEstimateCard.js')

function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}
function tree(r: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(r.toJSON())
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

describe('TaskAiEstimateCard', () => {
  it('Initial_ShowsTheRequestButton_AndNoProposal', () => {
    const r = render(
      <TaskAiEstimateCard
        baseUrl="https://api.test"
        category="feature"
        complexity="medium"
        onApply={() => {}}
      />,
    )
    expect(button(r, 'AI estimate')).toBeDefined()
    expect(tree(r)).not.toContain('Apply estimate')
  })

  it('AiProposal_RendersEstimateRationaleAndChargedChip_AndApplyIsEnabled', async () => {
    requestEstimate.mockResolvedValueOnce({
      source: 'ai-proposal',
      charged: true,
      estimateMinutes: 240,
      rationale: 'Similar features took about four hours.',
      baselineMin: 180,
      baselineMax: 480,
    })
    const onApply = vi.fn()
    const r = render(
      <TaskAiEstimateCard
        baseUrl="https://api.test"
        category="feature"
        complexity="medium"
        onApply={onApply}
      />,
    )
    await press(button(r, 'AI estimate'))

    expect(requestEstimate).toHaveBeenCalledTimes(1)
    expect(requestEstimate.mock.calls[0]?.[1]).toEqual({
      category: 'feature',
      complexity: 'medium',
    })
    const out = tree(r)
    expect(out).toContain('AI proposal')
    expect(out).toContain('4:00 h')
    expect(out).toContain('Similar features took about four hours.')
    expect(out).toContain('1 credit used')

    const apply = button(r, 'Apply estimate')
    expect(apply.props.disabled).toBeFalsy()
    await press(apply)
    expect(onApply).toHaveBeenCalledWith(240)
  })

  it('Deterministic_RendersAsFreeBaseline_WithNoChargedClaim', async () => {
    requestEstimate.mockResolvedValueOnce({
      source: 'deterministic',
      charged: false,
      estimateMinutes: 300,
      rationale: 'Provider unavailable — midpoint of the baseline range.',
      baselineMin: 180,
      baselineMax: 480,
    })
    const r = render(
      <TaskAiEstimateCard
        baseUrl="https://api.test"
        category="feature"
        complexity="large"
        onApply={() => {}}
      />,
    )
    await press(button(r, 'AI estimate'))

    const out = tree(r)
    expect(out).toContain('Free baseline')
    expect(out).toContain('5:00 h')
    expect(out).not.toContain('AI proposal')
    expect(out).not.toContain('1 credit used')
    // The user can still adopt the deterministic baseline as the estimate.
    expect(button(r, 'Apply estimate')).toBeDefined()
  })
})
