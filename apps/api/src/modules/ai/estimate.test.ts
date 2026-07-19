import { describe, expect, it } from 'vitest'
import { LlmEstimator } from './estimate.js'
import { LlmUnavailableError, type LlmPort, type LlmRequest, type LlmResult } from './llm/port.js'

/**
 * AI task-estimate review (REQ-041, #90 · ADR-0005): the deterministic baseline range both grounds
 * the AI and is the degradation fallback, and the AI's number is clamped into a sane multiple of the
 * baseline so it can adjust but never return an absurd value. These pin that contract — baseline-only
 * when AI is withheld, a valid AI proposal within bounds, an absurd number clamped, and a down
 * provider degrading to the baseline midpoint.
 */
class FakeLlm implements LlmPort {
  readonly provider = 'openai' as const
  constructor(
    private up: boolean,
    private reply: string,
  ) {}
  available(): Promise<boolean> {
    return Promise.resolve(this.up)
  }
  complete(_req: LlmRequest): Promise<LlmResult> {
    if (!this.up) return Promise.reject(new LlmUnavailableError('openai', 'down'))
    return Promise.resolve({
      text: this.reply,
      usage: { inputTokens: 1, outputTokens: 1 },
      provider: 'openai',
      model: 'fake',
    })
  }
}

// feature/medium → base {3h, 8h} × factor 1 → 180–480 min, midpoint 330 min.
const INPUT = { category: 'feature', complexity: 'medium' } as const

describe('LlmEstimator', () => {
  it('AiNotAllowed_ReturnsBaselineMidpointWithoutCallingModel', async () => {
    const estimator = new LlmEstimator(new FakeLlm(true, '{"estimateMinutes":300,"rationale":"x"}'))
    const res = await estimator.compose(INPUT, { allowAi: false })
    expect(res.source).toBe('deterministic')
    expect(res.baselineMin).toBe(180)
    expect(res.baselineMax).toBe(480)
    expect(res.estimateMinutes).toBe(330)
    expect(res.rationale).toBe('from category/complexity baseline')
  })

  it('AiProposal_WithinBounds_IsProposal', async () => {
    const estimator = new LlmEstimator(
      new FakeLlm(true, '{"estimateMinutes":300,"rationale":"medium feature, clear scope"}'),
    )
    const res = await estimator.compose(INPUT, { allowAi: true })
    expect(res.source).toBe('ai-proposal')
    expect(res.estimateMinutes).toBe(300)
    expect(res.rationale).toBe('medium feature, clear scope')
    expect(res.baselineMin).toBe(180)
    expect(res.baselineMax).toBe(480)
  })

  it('AiProposal_AbsurdlyHigh_IsClampedToBaselineMaxTimesTwo', async () => {
    const estimator = new LlmEstimator(
      new FakeLlm(true, '{"estimateMinutes":999999,"rationale":"huge"}'),
    )
    const res = await estimator.compose(INPUT, { allowAi: true })
    expect(res.source).toBe('ai-proposal')
    // clamp hi = baselineMax(480) * 2 = 960
    expect(res.estimateMinutes).toBe(960)
  })

  it('AiProposal_AbsurdlyLow_IsClampedToHalfBaselineMin', async () => {
    const estimator = new LlmEstimator(
      new FakeLlm(true, '{"estimateMinutes":1,"rationale":"tiny"}'),
    )
    const res = await estimator.compose(INPUT, { allowAi: true })
    expect(res.source).toBe('ai-proposal')
    // clamp lo = baselineMin(180) * 0.5 = 90
    expect(res.estimateMinutes).toBe(90)
  })

  it('ProviderDown_DegradesToBaseline', async () => {
    const estimator = new LlmEstimator(new FakeLlm(false, 'unused'))
    const res = await estimator.compose(INPUT, { allowAi: true })
    expect(res.source).toBe('deterministic')
    expect(res.estimateMinutes).toBe(330)
  })

  it('UnparseableCompletion_DegradesToBaseline', async () => {
    const estimator = new LlmEstimator(new FakeLlm(true, 'not json at all'))
    const res = await estimator.compose(INPUT, { allowAi: true })
    expect(res.source).toBe('deterministic')
    expect(res.estimateMinutes).toBe(330)
  })

  it('MissingDimensions_DefaultToFeatureMediumBaseline', async () => {
    const estimator = new LlmEstimator(new FakeLlm(true, 'unused'))
    const res = await estimator.compose({}, { allowAi: false })
    expect(res.source).toBe('deterministic')
    expect(res.baselineMin).toBe(180)
    expect(res.baselineMax).toBe(480)
    expect(res.estimateMinutes).toBe(330)
  })
})
