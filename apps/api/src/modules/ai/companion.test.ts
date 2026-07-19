import { describe, expect, it } from 'vitest'
import { LlmCompanion, type CompanionDayInput, type CompanionHistoryDay } from './companion.js'
import { LlmUnavailableError, type LlmPort, type LlmRequest, type LlmResult } from './llm/port.js'

/**
 * The Evening Companion (design v14 §H · ADR-0005): the deterministic wellbeing core (`reviewDay` +
 * `computeBaseline`) runs first and always — free, and the source of every number; the LLM only warms
 * those grounded facts into one paragraph + a forward suggestion. These pin: the review/baseline come
 * back on every path; the AI narration is grounded and marked `ai-proposal`; the suggestion KIND stays
 * deterministic even when the LLM rephrases it; a down provider, an unusable reply, no-AI, and an
 * absence day all degrade to a still-caring deterministic template with no model call and no charge.
 */
class FakeLlm implements LlmPort {
  readonly provider = 'openai' as const
  lastRequest: LlmRequest | null = null
  calls = 0
  constructor(
    private up: boolean,
    private reply: string,
  ) {}
  available(): Promise<boolean> {
    return Promise.resolve(this.up)
  }
  complete(req: LlmRequest): Promise<LlmResult> {
    this.calls += 1
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

// A heavy day: a long day, real overtime, missed breaks and back-to-back meetings.
const HEAVY_DAY: CompanionDayInput = {
  plannedMinutes: 360,
  actualMinutes: 600,
  overtimeMinutes: 90,
  breakShortfallMinutes: 30,
  meetingCount: 6,
  backToBackMeetingCount: 3,
  planDriftMinutes: 240,
  isAbsenceDay: false,
}

const HISTORY: CompanionHistoryDay[] = [
  { loadScore: 3, weekday: 1 },
  { loadScore: 4, weekday: 2 },
  { loadScore: 5, weekday: 3 },
  { loadScore: 6, weekday: 4 },
  { loadScore: 7, weekday: 5 },
]

const goodReply = JSON.stringify({
  narration: 'That was a full one — you carried a long day and a wall of meetings. Let it go now.',
  suggestion: 'Guard your first hour tomorrow before the calendar fills up.',
})

describe('LlmCompanion', () => {
  it('AiNarration_IsGroundedAndMarkedProposal_WithReviewAndBaseline', async () => {
    const llm = new FakeLlm(true, goodReply)
    const svc = new LlmCompanion(llm)

    const res = await svc.compose(HEAVY_DAY, HISTORY, { allowAi: true })

    // deterministic core owns the numbers, on the AI path too
    expect(res.review.loadLevel).toBe('overload')
    expect(res.review.signals.length).toBeGreaterThan(0)
    expect(res.baseline.trend).toBe('rising')
    // the AI narration is the model's, marked as a proposal
    expect(res.message.source).toBe('ai-proposal')
    expect(res.message.text).toContain('Let it go')
    // the suggestion KIND is deterministic; its phrasing may be the model's
    expect(res.suggestion?.kind).toBe('protect-morning')
    expect(res.suggestion?.text).toBe(
      'Guard your first hour tomorrow before the calendar fills up.',
    )
    expect(res.suggestion?.provenance).toBe('ai-proposal')
    // the prompt is grounded in the deterministic facts, never asked to invent numbers
    const content = llm.lastRequest?.messages[0]?.content ?? ''
    expect(content).toContain('Load level: overload')
    expect(content).toContain('invent NO numbers')
  })

  it('NoAi_DegradesToDeterministicTemplate_WithoutAModelCall', async () => {
    const llm = new FakeLlm(true, goodReply)
    const svc = new LlmCompanion(llm)

    const res = await svc.compose(HEAVY_DAY, HISTORY, { allowAi: false })

    expect(llm.calls).toBe(0)
    expect(res.message.source).toBe('deterministic')
    // the deterministic narration is built from the real signals (code's numbers)
    expect(res.message.text).toContain('90 min of overtime')
    expect(res.suggestion?.kind).toBe('protect-morning')
    expect(res.suggestion?.provenance).toBe('ai-proposal')
  })

  it('ProviderDown_DegradesToDeterministicTemplate', async () => {
    const svc = new LlmCompanion(new FakeLlm(false, 'unused'))

    const res = await svc.compose(HEAVY_DAY, HISTORY, { allowAi: true })

    expect(res.message.source).toBe('deterministic')
    expect(res.message.text.length).toBeGreaterThan(0)
    expect(res.review.loadLevel).toBe('overload')
  })

  it('UnusableReply_DegradesToDeterministicTemplate', async () => {
    // The model returned prose, not the strict JSON contract → we degrade rather than surface it.
    const svc = new LlmCompanion(new FakeLlm(true, 'here is a lovely thought about your day'))

    const res = await svc.compose(HEAVY_DAY, HISTORY, { allowAi: true })

    expect(res.message.source).toBe('deterministic')
  })

  it('AbsenceDay_IsAWarmFreeRestNote_WithNoModelCall', async () => {
    const llm = new FakeLlm(true, goodReply)
    const svc = new LlmCompanion(llm)
    const day: CompanionDayInput = { ...HEAVY_DAY, isAbsenceDay: true }

    const res = await svc.compose(day, HISTORY, { allowAi: true })

    expect(llm.calls).toBe(0)
    expect(res.message.source).toBe('deterministic')
    expect(res.review.signals).toEqual([])
    expect(res.suggestion?.kind).toBe('rest-day')
  })

  it('ShortHistory_YieldsAWideBaselineBand', async () => {
    const svc = new LlmCompanion(new FakeLlm(false, 'unused'))

    const res = await svc.compose(HEAVY_DAY, [{ loadScore: 4, weekday: 1 }], { allowAi: true })

    // below the minimum history the band is wide and the trend steady (honest empty state)
    expect(res.baseline.trend).toBe('steady')
    expect(res.baseline.normalHigh).toBe(Number.POSITIVE_INFINITY)
  })

  it('MissingSuggestionText_FallsBackToTheDeterministicPhrasing', async () => {
    const reply = JSON.stringify({ narration: 'A gentle close to a heavy day.', suggestion: '' })
    const svc = new LlmCompanion(new FakeLlm(true, reply))

    const res = await svc.compose(HEAVY_DAY, HISTORY, { allowAi: true })

    expect(res.message.source).toBe('ai-proposal')
    expect(res.suggestion?.kind).toBe('protect-morning')
    expect(res.suggestion?.text).toContain('Protect tomorrow morning')
  })
})
