import { describe, expect, it } from 'vitest'
import { NullLlm } from './llm/null-llm.js'
import { LlmUnavailableError, type LlmPort, type LlmResult } from './llm/port.js'
import { LlmAssistant, deterministicAnswer } from './assistant.js'

/**
 * The grounded assistant (M2): it answers only from supplied facts, the LLM merely
 * phrases them, and it degrades to the best-matching fact (or a clean refusal) when
 * the provider is down or the answer is not in the data (ADR-0005/0029).
 */
const facts = [
  'This week: 41h 15m tracked.',
  'Top project: Finanzo with 14.5h.',
  'Overtime balance: +1h 30m.',
]

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

describe('deterministicAnswer', () => {
  it('PicksTheFactWithTheMostWordOverlap', () => {
    const out = deterministicAnswer('What is my overtime balance?', facts)
    expect(out.refused).toBe(false)
    expect(out.text).toContain('Overtime balance')
  })
  it('RefusesWhenNothingOverlaps', () => {
    expect(deterministicAnswer('What is the weather?', facts).refused).toBe(true)
  })
  it('RefusesWhenThereAreNoFacts', () => {
    expect(deterministicAnswer('anything', []).refused).toBe(true)
  })
})

describe('LlmAssistant', () => {
  it('NullLlm_DegradesToTheBestMatchingFact', async () => {
    const out = await new LlmAssistant(new NullLlm()).answer('Top-Projekt?', facts, {
      allowAi: true,
    })
    expect(out.source).toBe('deterministic')
    expect(out.text).toContain('Finanzo')
  })

  it('AllowAiFalse_UsesTheDeterministicPath', async () => {
    const spy: LlmPort = {
      provider: 'openai',
      available: () => Promise.resolve(true),
      complete: () => Promise.reject(new Error('should not run')),
    }
    const out = await new LlmAssistant(spy).answer('Top-Projekt?', facts, { allowAi: false })
    expect(out.source).toBe('deterministic')
  })

  it('ValidCompletion_YieldsAiProposal', async () => {
    const out = await new LlmAssistant(fakeLlm('Your top project is Finanzo with 14.5h.')).answer(
      'What is my top project?',
      facts,
      { allowAi: true },
    )
    expect(out.source).toBe('ai-proposal')
    expect(out.refused).toBe(false)
    expect(out.text).toContain('Finanzo')
  })

  it('RefusalMarker_IsReportedAsRefused', async () => {
    const out = await new LlmAssistant(fakeLlm('NO_DATA')).answer('Weather?', facts, {
      allowAi: true,
    })
    expect(out.source).toBe('ai-proposal')
    expect(out.refused).toBe(true)
  })

  it('ThrownProvider_FallsBackToDeterministic', async () => {
    const flaky: LlmPort = {
      provider: 'openai',
      available: () => Promise.resolve(true),
      complete: () => Promise.reject(new LlmUnavailableError('openai')),
    }
    const out = await new LlmAssistant(flaky).answer('Top-Projekt?', facts, { allowAi: true })
    expect(out.source).toBe('deterministic')
  })
})
