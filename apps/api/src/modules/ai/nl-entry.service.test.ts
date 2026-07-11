import { describe, expect, it } from 'vitest'
import { NlEntryService } from './nl-entry.service.js'
import { NullLlm } from './llm/null-llm.js'
import { LlmUnavailableError, type LlmPort } from './llm/port.js'

/**
 * NL time entry (REQ-013): the deterministic parser answers first; only what it
 * can't parse falls to the LLM, and the LLM's reply is re-parsed through the same
 * core so no entry bypasses it (ADR-0005). With the `NullLlm` default the fallback
 * degrades to `none` instead of failing (ADR-0029).
 */
describe('NlEntryService', () => {
  it('ReturnsADeterministicDraftForAParseablePhrase', async () => {
    const svc = new NlEntryService(new NullLlm())
    const { draft, source } = await svc.draft('2h on Finanzo review yesterday')
    expect(source).toBe('deterministic')
    expect(draft?.durationMs).toBe(2 * 3_600_000)
    expect(draft?.projectHint).toBe('Finanzo')
    expect(draft?.dayOffset).toBe(-1)
  })

  it('ResolvesABareKnownProjectNameToTheProjectHint', async () => {
    const svc = new NlEntryService(new NullLlm())
    const { draft, source } = await svc.draft('2h logo feinschliff', ['Logo', 'Finanzo'])
    expect(source).toBe('deterministic')
    expect(draft?.projectHint).toBe('Logo')
    expect(draft?.note).toBe('feinschliff')
  })

  it('DegradesToNoneWhenUnparseableAndNoLlm', async () => {
    const svc = new NlEntryService(new NullLlm())
    const result = await svc.draft('did some finanzo work')
    expect(result).toEqual({ draft: null, source: 'none' })
  })

  it('UsesTheLlmFallbackAndRe-parsesItsReply', async () => {
    // A fake available LLM that rewrites the note into a parseable phrase.
    const fake: LlmPort = {
      provider: 'openai',
      available: () => Promise.resolve(true),
      complete: () =>
        Promise.resolve({
          text: '90m Finanzo',
          usage: { inputTokens: 10, outputTokens: 5 },
          provider: 'openai',
          model: 'test',
        }),
    }
    const svc = new NlEntryService(fake)
    const { draft, source } = await svc.draft('spent an hour and a half on finanzo')
    expect(source).toBe('ai-proposal')
    expect(draft?.durationMs).toBe(90 * 60_000)
  })

  it('DegradesWhenTheLlmThrowsUnavailable', async () => {
    const flaky: LlmPort = {
      provider: 'anthropic',
      available: () => Promise.resolve(true),
      complete: () => Promise.reject(new LlmUnavailableError('anthropic')),
    }
    const svc = new NlEntryService(flaky)
    expect(await svc.draft('did some work')).toEqual({ draft: null, source: 'none' })
  })
})
