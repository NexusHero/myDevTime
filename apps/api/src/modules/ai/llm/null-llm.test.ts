import { describe, expect, it } from 'vitest'
import { NullLlm } from './null-llm.js'
import { LlmUnavailableError } from './port.js'

/**
 * The graceful-degradation default (ADR-0029): the Null LLM reports unavailable and
 * refuses completion with a typed error, so an AI feature degrades instead of
 * crashing and the deterministic core is never blocked on a provider (ADR-0005).
 */
describe('NullLlm', () => {
  const llm = new NullLlm()

  it('IsNeverAvailable', async () => {
    expect(await llm.available()).toBe(false)
    expect(llm.provider).toBe('null')
  })

  it('RefusesCompletionWithLlmUnavailableError', async () => {
    await expect(
      llm.complete({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(LlmUnavailableError)
  })

  it('CarriesTheProviderOnTheError', async () => {
    await llm.complete({ messages: [] }).catch((err: unknown) => {
      expect(err).toBeInstanceOf(LlmUnavailableError)
      if (err instanceof LlmUnavailableError) expect(err.provider).toBe('null')
    })
  })
})
