import { describe, expect, it } from 'vitest'
import { VercelLlm, type GenerateArgs, type GenerateReply } from './vercel-llm.js'
import { LlmUnavailableError } from './port.js'
import { readLlmConfig } from './llm.provider.js'

/**
 * The library-backed adapter (ADR-0029): one `LlmPort` over the Vercel AI SDK. These
 * pin the provider-agnostic mapping and the config resolution *without* a network or
 * a key — the SDK call is injected as a fake, and `readLlmConfig` is a pure function
 * of the environment. The real `createVercelGenerate` (the vendor-touching path) is
 * exercised only against a live provider, out of the unit gate by design.
 */
const noopGenerate = (): Promise<GenerateReply> =>
  Promise.resolve({ text: '', inputTokens: 0, outputTokens: 0 })

describe('VercelLlm', () => {
  it('Complete_MapsRequestAndUsageThroughTheInjectedCall', async () => {
    const seen: GenerateArgs[] = []
    const fake = (args: GenerateArgs): Promise<GenerateReply> => {
      seen.push(args)
      return Promise.resolve({ text: '2h Finanzo review', inputTokens: 11, outputTokens: 5 })
    }
    const llm = new VercelLlm({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'k' }, fake)

    const result = await llm.complete({
      messages: [{ role: 'user', content: 'zwei Stunden Finanzo review' }],
      maxOutputTokens: 60,
      temperature: 0,
    })

    expect(result).toEqual({
      text: '2h Finanzo review',
      usage: { inputTokens: 11, outputTokens: 5 },
      provider: 'openai',
      model: 'gpt-4o-mini',
    })
    expect(seen[0]?.maxOutputTokens).toBe(60)
    expect(seen[0]?.messages[0]?.content).toBe('zwei Stunden Finanzo review')
  })

  it('Complete_ForwardsResponseSchemaToTheGenerateCall', async () => {
    // Regression: without the schema the provider answers in prose and structured
    // output silently degrades — every JSON feature on the port must constrain it.
    const seen: GenerateArgs[] = []
    const schema = { type: 'array', items: { type: 'object' } }
    const fake = (args: GenerateArgs): Promise<GenerateReply> => {
      seen.push(args)
      return Promise.resolve({ text: '[]', inputTokens: 1, outputTokens: 1 })
    }
    const llm = new VercelLlm({ provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'k' }, fake)

    await llm.complete({
      messages: [{ role: 'user', content: 'label these blocks' }],
      responseSchema: schema,
      temperature: 0,
    })

    expect(seen[0]?.jsonSchema).toEqual(schema)
  })

  it('Complete_OmitsJsonSchemaWhenNoResponseSchemaGiven', async () => {
    const seen: GenerateArgs[] = []
    const fake = (args: GenerateArgs): Promise<GenerateReply> => {
      seen.push(args)
      return Promise.resolve({ text: 'plain', inputTokens: 1, outputTokens: 1 })
    }
    const llm = new VercelLlm({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'k' }, fake)

    await llm.complete({ messages: [{ role: 'user', content: 'hi' }] })

    expect(seen[0]?.jsonSchema).toBeUndefined()
  })

  it('Complete_WrapsProviderErrorsAsUnavailable', async () => {
    const fake = (): Promise<GenerateReply> => Promise.reject(new Error('429 rate limited'))
    const llm = new VercelLlm(
      { provider: 'anthropic', model: 'claude-3-5-haiku-latest', apiKey: 'k' },
      fake,
    )

    await expect(
      llm.complete({ messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toBeInstanceOf(LlmUnavailableError)
  })

  it('Available_ReflectsWhetherTheProviderIsConfigured', async () => {
    expect(
      await new VercelLlm(
        { provider: 'openai', model: 'm', apiKey: 'k' },
        noopGenerate,
      ).available(),
    ).toBe(true)
    expect(await new VercelLlm({ provider: 'openai', model: 'm' }, noopGenerate).available()).toBe(
      false,
    )
    expect(
      await new VercelLlm(
        { provider: 'ollama', model: 'm', baseUrl: 'http://host/v1' },
        noopGenerate,
      ).available(),
    ).toBe(true)
  })

  it('Complete_CarriesTheOpenRouterProviderThroughTheResult', async () => {
    // OpenRouter is a key-authenticated, OpenAI-compatible gateway; the port must
    // report it verbatim so the credit ledger (REQ-027) attributes usage to it.
    const fake = (): Promise<GenerateReply> =>
      Promise.resolve({ text: 'ok', inputTokens: 3, outputTokens: 2 })
    const llm = new VercelLlm(
      { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', apiKey: 'k' },
      fake,
    )

    const result = await llm.complete({ messages: [{ role: 'user', content: 'x' }] })

    expect(result.provider).toBe('openrouter')
    expect(result.model).toBe('anthropic/claude-3.5-sonnet')
    expect(await llm.available()).toBe(true)
  })
})

describe('readLlmConfig', () => {
  it('IsNullWhenUnsetOrExplicitlyNullOrUnknown', () => {
    expect(readLlmConfig({})).toBeNull()
    expect(readLlmConfig({ LLM_PROVIDER: 'null' })).toBeNull()
    expect(readLlmConfig({ LLM_PROVIDER: 'langchain' })).toBeNull()
  })

  it('RequiresAKeyForHostedProviders', () => {
    expect(readLlmConfig({ LLM_PROVIDER: 'openai' })).toBeNull()
    expect(readLlmConfig({ LLM_PROVIDER: 'openai', LLM_API_KEY: 'k' })).toEqual({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'k',
    })
  })

  it('DefaultsTheOllamaBaseUrlAndNeedsNoKey', () => {
    expect(readLlmConfig({ LLM_PROVIDER: 'ollama' })).toEqual({
      provider: 'ollama',
      model: 'llama3.1',
      baseUrl: 'http://localhost:11434/v1',
    })
  })

  it('HonorsAnExplicitModelAndBaseUrl', () => {
    const cfg = readLlmConfig({
      LLM_PROVIDER: 'gemini',
      LLM_API_KEY: 'k',
      LLM_MODEL: 'gemini-1.5-pro',
    })
    expect(cfg?.model).toBe('gemini-1.5-pro')
  })

  it('OpenRouterNeedsAKeyAndDefaultsItsBaseUrl', () => {
    // OpenRouter is key-authenticated like the hosted providers, but points at its
    // own OpenAI-compatible gateway; the base URL is defaulted so only the key is
    // required to switch the whole app onto it.
    expect(readLlmConfig({ LLM_PROVIDER: 'openrouter' })).toBeNull()
    expect(readLlmConfig({ LLM_PROVIDER: 'openrouter', LLM_API_KEY: 'k' })).toEqual({
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      apiKey: 'k',
      baseUrl: 'https://openrouter.ai/api/v1',
    })
  })

  it('OpenRouterHonorsAnExplicitModelAndBaseUrl', () => {
    expect(
      readLlmConfig({
        LLM_PROVIDER: 'openrouter',
        LLM_API_KEY: 'k',
        LLM_MODEL: 'anthropic/claude-3.5-sonnet',
        LLM_BASE_URL: 'https://gateway.internal/v1',
      }),
    ).toEqual({
      provider: 'openrouter',
      model: 'anthropic/claude-3.5-sonnet',
      apiKey: 'k',
      baseUrl: 'https://gateway.internal/v1',
    })
  })
})
