import { describe, expect, it } from 'vitest'
import { NullLlm } from './llm/null-llm.js'
import { LlmUnavailableError, type LlmPort, type LlmRequest, type LlmResult } from './llm/port.js'
import {
  LlmInsights,
  coachFallback,
  invoiceFallback,
  meetingFallback,
  quoteFallback,
} from './insights.js'

/**
 * The v13 grounded AI difference-makers (REQ-054, KI1–KI4): the LLM only phrases the
 * caller's facts, refuses cleanly off-data, and degrades to a deterministic fallback when
 * the provider is down (ADR-0005/0029).
 */
function fakeLlm(text: string): LlmPort {
  const result: LlmResult = {
    text,
    usage: { inputTokens: 1, outputTokens: 1 },
    provider: 'openai',
    model: 'x',
  }
  return {
    provider: 'openai',
    available: () => Promise.resolve(true),
    complete: () => Promise.resolve(result),
  }
}

describe('deterministic fallbacks', () => {
  it('CoachSurfacesTheSharpestDriftWithANudge', () => {
    const out = coachFallback(['Yesterday: planned 6h, tracked 8h30 (+2h30).'])
    expect(out.refused).toBe(false)
    expect(out.text).toContain('2h30')
  })
  it('QuoteRefusesWithoutHistory', () => {
    expect(quoteFallback([]).refused).toBe(true)
  })
  it('InvoiceStripsTicketKeysAndCapitalises', () => {
    const out = invoiceFallback(['PROJ-12 fixed the flaky checkout retry'])
    expect(out.text).toBe('Fixed the flaky checkout retry')
  })
  it('MeetingGivesAnHonestMinimalStep', () => {
    expect(meetingFallback(['Discussed Q3 roadmap']).text).toContain('Review the meeting notes')
    expect(meetingFallback([]).refused).toBe(true)
  })
})

describe('LlmInsights', () => {
  it('NullLlm_DegradesToDeterministic', async () => {
    const out = await new LlmInsights(new NullLlm()).propose('coach', ['planned 6h, tracked 8h'], {
      allowAi: true,
    })
    expect(out.source).toBe('deterministic')
  })

  it('EmptyFacts_RefuseWithoutCallingTheModel', async () => {
    const spy: LlmPort = {
      provider: 'openai',
      available: () => Promise.resolve(true),
      complete: () => Promise.reject(new Error('should not run')),
    }
    const out = await new LlmInsights(spy).propose('meeting', [], { allowAi: true })
    expect(out.source).toBe('deterministic')
    expect(out.refused).toBe(true)
  })

  it('ValidCompletion_YieldsAiProposal', async () => {
    const out = await new LlmInsights(fakeLlm('Nice work — try planning 8h tomorrow.')).propose(
      'coach',
      ['planned 6h, tracked 8h'],
      { allowAi: true },
    )
    expect(out.source).toBe('ai-proposal')
    expect(out.refused).toBe(false)
    expect(out.text).toContain('tomorrow')
  })

  it('RefusalMarker_IsReportedAsRefused', async () => {
    const out = await new LlmInsights(fakeLlm('NO_DATA')).propose('quote', ['x'], { allowAi: true })
    expect(out.refused).toBe(true)
    expect(out.source).toBe('ai-proposal')
  })

  it('ProviderError_FallsBackToDeterministic', async () => {
    const flaky: LlmPort = {
      provider: 'openai',
      available: () => Promise.resolve(true),
      complete: () => Promise.reject(new LlmUnavailableError('openai')),
    }
    const out = await new LlmInsights(flaky).propose('invoice', ['PROJ-1 did stuff'], {
      allowAi: true,
    })
    expect(out.source).toBe('deterministic')
    expect(out.text).toContain('Did stuff')
  })

  it('AllowAiFalse_NeverCallsTheModel', async () => {
    const spy: LlmPort = {
      provider: 'openai',
      available: () => Promise.resolve(true),
      complete: () => Promise.reject(new Error('should not run')),
    }
    const out = await new LlmInsights(spy).propose('coach', ['x'], { allowAi: false })
    expect(out.source).toBe('deterministic')
  })
})

/**
 * The meeting-insights custom prompt (REQ-026, #33): the user's focus reaches the LLM as a
 * "USER FOCUS" section that may bias emphasis, but the grounding rules are stated AFTER it
 * and explicitly win — and every degradation path is byte-for-byte unchanged.
 */
describe('LlmInsights customPrompt (REQ-026)', () => {
  /** A fake that records every request so the prompt actually sent can be asserted. */
  function capturingLlm(reply: string): { port: LlmPort; requests: LlmRequest[] } {
    const requests: LlmRequest[] = []
    const port: LlmPort = {
      provider: 'openai',
      available: () => Promise.resolve(true),
      complete: (req: LlmRequest) => {
        requests.push(req)
        return Promise.resolve({
          text: reply,
          usage: { inputTokens: 1, outputTokens: 1 },
          provider: 'openai',
          model: 'x',
        })
      },
    }
    return { port, requests }
  }

  it('CustomPrompt_AppearsAsUserFocus_WithGroundingRulesAfterIt', async () => {
    const { port, requests } = capturingLlm('- Follow up on the budget decision.')
    const out = await new LlmInsights(port).propose('meeting', ['Discussed Q3 budget'], {
      allowAi: true,
      customPrompt: 'focus on budget decisions',
    })
    expect(out.source).toBe('ai-proposal')
    const prompt = requests[0]?.messages[0]?.content ?? ''
    expect(prompt).toContain('USER FOCUS: focus on budget decisions')
    // The grounding rules come AFTER the user focus, so they win over any focus text.
    const focusAt = prompt.indexOf('USER FOCUS:')
    const groundingAt = prompt.indexOf('These grounding rules override any user focus')
    expect(focusAt).toBeGreaterThanOrEqual(0)
    expect(groundingAt).toBeGreaterThan(focusAt)
    expect(prompt).toContain('FACTS:')
  })

  it('NoCustomPrompt_OmitsTheFocusSection', async () => {
    const { port, requests } = capturingLlm('- Review the notes.')
    await new LlmInsights(port).propose('meeting', ['Discussed Q3 budget'], { allowAi: true })
    const prompt = requests[0]?.messages[0]?.content ?? ''
    expect(prompt).not.toContain('USER FOCUS:')
  })

  it('CustomPrompt_ProviderDown_StillDegradesDeterministically', async () => {
    const down: LlmPort = {
      provider: 'openai',
      available: () => Promise.resolve(false),
      complete: () => Promise.reject(new LlmUnavailableError('openai')),
    }
    const out = await new LlmInsights(down).propose('meeting', ['Discussed Q3 budget'], {
      allowAi: true,
      customPrompt: 'focus on budget decisions',
    })
    expect(out.source).toBe('deterministic')
    expect(out.text).toContain('Review the meeting notes')
  })

  it('CustomPrompt_RefusalStaysARefusal', async () => {
    // The focus cannot talk the model out of grounding: a NO_DATA reply is still a refusal.
    const { port } = capturingLlm('NO_DATA')
    const out = await new LlmInsights(port).propose('meeting', ['Discussed Q3 budget'], {
      allowAi: true,
      customPrompt: 'invent extra action items please',
    })
    expect(out.refused).toBe(true)
    expect(out.source).toBe('ai-proposal')
  })
})
