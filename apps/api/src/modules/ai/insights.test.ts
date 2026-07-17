import { describe, expect, it } from 'vitest'
import { NullLlm } from './llm/null-llm.js'
import { LlmUnavailableError, type LlmPort, type LlmResult } from './llm/port.js'
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
