import { describe, expect, it } from 'vitest'
import { LlmStandupWriter } from './standup.js'
import { LlmUnavailableError, type LlmPort, type LlmRequest, type LlmResult } from './llm/port.js'

/**
 * The AI standup writer (REQ-014, ADR-0005): the LLM narrates around the deterministic report's
 * protected numeric slots but can never change one. These pin the degradation contract — down
 * provider, credits off, empty day, or a slot-violating draft all fall back to the plain template —
 * and that a valid draft that keeps every figure is surfaced as an `ai-proposal`.
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

const INPUT = {
  date: '2026-07-18',
  yesterday: [{ label: 'Sync engine', ms: 3 * 3_600_000 }],
  today: [{ label: 'Rules API', ms: 90 * 60_000 }],
  blockers: [],
}

describe('LlmStandupWriter', () => {
  it('AiPath_KeepsEverySlot_IsProposal', async () => {
    // A narrative that repeats every figure (3h, 1h 30m, and the two totals) is trustworthy.
    const draft =
      'Yesterday I spent 3h on Sync engine. Today 1h 30m on Rules API. Totals: 3h, 1h 30m.'
    const writer = new LlmStandupWriter(new FakeLlm(true, draft))
    const res = await writer.compose(INPUT, { allowAi: true })
    expect(res.source).toBe('ai-proposal')
    expect(res.text).toBe(draft)
    expect(res.report.totalYesterdayMs).toBe(3 * 3_600_000)
  })

  it('AiPath_DroppedFigure_FallsBackToPlain', async () => {
    // The model changed a number (2h instead of 3h) — slot integrity rejects it.
    const writer = new LlmStandupWriter(new FakeLlm(true, 'Worked 2h yesterday, a bit today.'))
    const res = await writer.compose(INPUT, { allowAi: true })
    expect(res.source).toBe('deterministic')
    expect(res.text).toContain('3h') // the honest plain template
  })

  it('ProviderDown_DegradesToPlain', async () => {
    const writer = new LlmStandupWriter(new FakeLlm(false, 'unused'))
    const res = await writer.compose(INPUT, { allowAi: true })
    expect(res.source).toBe('deterministic')
  })

  it('AiNotAllowed_DegradesToPlainWithoutCallingModel', async () => {
    const writer = new LlmStandupWriter(new FakeLlm(true, 'should not appear'))
    const res = await writer.compose(INPUT, { allowAi: false })
    expect(res.source).toBe('deterministic')
    expect(res.text).not.toContain('should not appear')
  })

  it('EmptyDay_DegradesToPlain', async () => {
    const writer = new LlmStandupWriter(new FakeLlm(true, 'ignored'))
    const res = await writer.compose(
      { date: '2026-07-18', yesterday: [], today: [], blockers: [] },
      { allowAi: true },
    )
    expect(res.source).toBe('deterministic')
    expect(res.text).toContain('nothing tracked')
  })
})
