import type { Provider } from '@nestjs/common'
import type { LlmPort } from './port.js'
import { NullLlm } from './null-llm.js'
import { VercelLlm, type ConfiguredProvider, type VercelLlmConfig } from './vercel-llm.js'

/**
 * The DI token + provider that binds the configured `LlmPort` (ADR-0029). The
 * provider is a runtime choice: `LLM_PROVIDER` (+ `LLM_MODEL`, `LLM_API_KEY` or
 * `LLM_BASE_URL`) selects a vendor, which the library-backed `VercelLlm` adapter
 * serves. Unconfigured (or `null`) resolves the `NullLlm` so the AI layer degrades
 * gracefully by default. Consumers inject `LLM`, never a vendor SDK — and never a
 * key from source: everything here reads from the environment.
 */
export const LLM = Symbol('LLM')

const DEFAULT_MODEL: Record<ConfiguredProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  gemini: 'gemini-1.5-flash',
  ollama: 'llama3.1',
  // OpenRouter model ids are namespaced by upstream vendor; a cheap default.
  openrouter: 'openai/gpt-4o-mini',
}

function isConfiguredProvider(value: string): value is ConfiguredProvider {
  return (
    value === 'openai' ||
    value === 'anthropic' ||
    value === 'gemini' ||
    value === 'ollama' ||
    value === 'openrouter'
  )
}

/**
 * Resolve the LLM config from the environment. Returns `null` — meaning "use the
 * `NullLlm`" — when no provider is set, it is explicitly `null`, it is unknown, or a
 * hosted provider is missing its key. Ollama needs no key and defaults its base URL;
 * OpenRouter needs a key and defaults its OpenAI-compatible gateway base URL.
 */
export function readLlmConfig(env: NodeJS.ProcessEnv = process.env): VercelLlmConfig | null {
  const provider = env.LLM_PROVIDER
  if (provider === undefined || provider === '' || provider === 'null') return null
  if (!isConfiguredProvider(provider)) return null

  const model =
    env.LLM_MODEL !== undefined && env.LLM_MODEL !== '' ? env.LLM_MODEL : DEFAULT_MODEL[provider]
  const apiKey = env.LLM_API_KEY
  const baseUrl = env.LLM_BASE_URL

  if (provider === 'ollama') {
    return {
      provider,
      model,
      baseUrl: baseUrl !== undefined && baseUrl !== '' ? baseUrl : 'http://localhost:11434/v1',
      ...(apiKey === undefined || apiKey === '' ? {} : { apiKey }),
    }
  }

  if (apiKey === undefined || apiKey === '') return null

  if (provider === 'openrouter') {
    return {
      provider,
      model,
      apiKey,
      baseUrl: baseUrl !== undefined && baseUrl !== '' ? baseUrl : 'https://openrouter.ai/api/v1',
    }
  }

  return {
    provider,
    model,
    apiKey,
    ...(baseUrl === undefined || baseUrl === '' ? {} : { baseUrl }),
  }
}

export const llmProvider: Provider = {
  provide: LLM,
  useFactory: (): LlmPort => {
    const config = readLlmConfig()
    return config ? new VercelLlm(config) : new NullLlm()
  },
}
