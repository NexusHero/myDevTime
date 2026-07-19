import { describe, expect, it } from 'vitest'
import { LlmMeetingInsights, type MeetingSegmentInput } from './meeting-insights.js'
import { LlmUnavailableError, type LlmPort, type LlmRequest, type LlmResult } from './llm/port.js'

/**
 * Meeting insights over a supplied transcript (REQ-026, #33 · ADR-0005): facts and confirmed-only
 * action-item proposals come from the deterministic core (no LLM needed); an optional AI summary is
 * grounded in the transcript with the caller's custom focus biasing emphasis only. These pin: facts
 * are extracted, action items are confirmed-only `ai-proposal`s, the custom prompt is threaded into
 * the summary prompt, and the deterministic path runs without any model call.
 */
class FakeLlm implements LlmPort {
  readonly provider = 'openai' as const
  lastRequest: LlmRequest | null = null
  constructor(
    private up: boolean,
    private reply: string,
  ) {}
  available(): Promise<boolean> {
    return Promise.resolve(this.up)
  }
  complete(req: LlmRequest): Promise<LlmResult> {
    this.lastRequest = req
    if (!this.up) return Promise.reject(new LlmUnavailableError('openai', 'down'))
    return Promise.resolve({
      text: this.reply,
      usage: { inputTokens: 1, outputTokens: 1 },
      provider: 'openai',
      model: 'fake',
    })
  }
}

const SEGMENTS: MeetingSegmentInput[] = [
  { speaker: 'Ann', startMs: 0, endMs: 1000, text: 'We will ship the pricing API on Friday.' },
  { speaker: 'Ben', startMs: 1000, endMs: 2000, text: 'Ben should review the migration PR.' },
  { speaker: 'Ann', startMs: 2000, endMs: 3000, text: 'The demo went well overall.' },
]

describe('LlmMeetingInsights', () => {
  it('DeterministicPath_ExtractsFactsAndConfirmedOnlyActionItems', async () => {
    // allowAi:false → no model call; facts + action items are the deterministic core's.
    const svc = new LlmMeetingInsights(new FakeLlm(true, 'should not be used'))
    const res = await svc.compose(SEGMENTS, { allowAi: false })

    expect(res.summary.source).toBe('deterministic')
    // grounded fact lines are present (action-like ones ordered first)
    expect(res.facts).toContain('We will ship the pricing API on Friday.')
    expect(res.facts).toContain('Ben should review the migration PR.')
    // action items are confirmed-only proposals — never a booked task
    expect(res.actionItems.length).toBeGreaterThan(0)
    for (const item of res.actionItems) {
      expect(item.provenance).toBe('ai-proposal')
    }
    expect(res.actionItems.map(a => a.text)).toContain('We will ship the pricing API on Friday.')
  })

  it('CustomPrompt_IsThreadedIntoTheSummaryPrompt', async () => {
    const llm = new FakeLlm(true, 'Ann and Ben agreed to ship the pricing API on Friday.')
    const svc = new LlmMeetingInsights(llm)
    const res = await svc.compose(SEGMENTS, {
      allowAi: true,
      customPrompt: 'focus on the launch decisions',
    })

    expect(res.summary.source).toBe('ai-proposal')
    expect(res.summary.text).toContain('pricing API')
    const content = llm.lastRequest?.messages[0]?.content ?? ''
    expect(content).toContain('USER FOCUS: focus on the launch decisions')
    // the transcript itself is the grounding
    expect(content).toContain('We will ship the pricing API on Friday.')
  })

  it('ProviderDown_DegradesToDeterministicSummary', async () => {
    const svc = new LlmMeetingInsights(new FakeLlm(false, 'unused'))
    const res = await svc.compose(SEGMENTS, { allowAi: true })

    expect(res.summary.source).toBe('deterministic')
    // the deterministic summary is the grounded fact lines
    expect(res.summary.text).toContain('We will ship the pricing API on Friday.')
    expect(res.actionItems.every(a => (a.provenance as string) === 'ai-proposal')).toBe(true)
  })

  it('EmptyTranscript_DegradesWithHonestSummaryAndNoActionItems', async () => {
    const svc = new LlmMeetingInsights(new FakeLlm(true, 'ignored'))
    const res = await svc.compose([], { allowAi: true })

    expect(res.summary.source).toBe('deterministic')
    expect(res.facts).toEqual([])
    expect(res.actionItems).toEqual([])
  })
})
