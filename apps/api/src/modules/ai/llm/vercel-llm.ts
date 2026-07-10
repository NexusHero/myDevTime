import { generateText, type LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import {
  LlmUnavailableError,
  type LlmPort,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
} from './port.js'

/**
 * The single, library-backed `LlmPort` adapter (ADR-0029, amended). Instead of one
 * hand-written SDK adapter per vendor, the provider-agnostic **Vercel AI SDK** does
 * the multi-provider dispatch; this file is the *only* place its types are touched
 * (skill §2.2). OpenAI, Anthropic (Claude), Google Gemini and Ollama (via its
 * OpenAI-compatible endpoint) are all reached through one `generateText` call, the
 * provider chosen by config. Nothing upstream imports a vendor type; the port stays
 * the contract. The LLM only *proposes* — the deterministic core validates every
 * result (ADR-0005).
 */

/** A configured, non-null provider (the `null` case is served by `NullLlm`). */
export type ConfiguredProvider = Exclude<LlmProvider, 'null'>

export interface VercelLlmConfig {
  readonly provider: ConfiguredProvider
  readonly model: string
  /** Hosted providers authenticate with a key; Ollama points at a base URL. */
  readonly apiKey?: string
  readonly baseUrl?: string
}

/**
 * The narrow call the adapter depends on — provider-agnostic in and out, no vendor
 * types. `createVercelGenerate` is the one real implementation over the SDK; tests
 * inject a fake of this shape so the request/usage mapping is verified without a
 * network round-trip or a real key.
 */
export interface GenerateArgs {
  readonly messages: readonly {
    readonly role: 'system' | 'user' | 'assistant'
    readonly content: string
  }[]
  readonly maxOutputTokens?: number
  readonly temperature?: number
}

export interface GenerateReply {
  readonly text: string
  readonly inputTokens: number
  readonly outputTokens: number
}

export type GenerateFn = (args: GenerateArgs) => Promise<GenerateReply>

/** Build the SDK model for a provider — the sole spot that names a vendor factory. */
function buildModel(config: VercelLlmConfig): LanguageModel {
  const key = config.apiKey === undefined ? {} : { apiKey: config.apiKey }
  switch (config.provider) {
    case 'openai':
      return createOpenAI(key).chat(config.model)
    case 'anthropic':
      return createAnthropic(key)(config.model)
    case 'gemini':
      return createGoogleGenerativeAI(key)(config.model)
    case 'ollama':
      // Ollama serves an OpenAI-compatible API; the base URL selects the local host.
      return createOpenAI({
        baseURL: config.baseUrl ?? 'http://localhost:11434/v1',
        apiKey: config.apiKey ?? 'ollama',
      }).chat(config.model)
  }
}

/** The real generate function over the Vercel AI SDK (network-bound). */
export function createVercelGenerate(config: VercelLlmConfig): GenerateFn {
  const model = buildModel(config)
  return async (args: GenerateArgs): Promise<GenerateReply> => {
    const result = await generateText({
      model,
      messages: args.messages.map(m => ({ role: m.role, content: m.content })),
      ...(args.maxOutputTokens === undefined ? {} : { maxOutputTokens: args.maxOutputTokens }),
      ...(args.temperature === undefined ? {} : { temperature: args.temperature }),
    })
    return {
      text: result.text,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    }
  }
}

/**
 * The `LlmPort` over the Vercel AI SDK. `complete` maps port types → the injected
 * generate call → port types and never lets a vendor error escape untyped: any
 * failure becomes `LlmUnavailableError`, so every feature's degradation path
 * (ADR-0005/0029) fires uniformly.
 */
export class VercelLlm implements LlmPort {
  readonly provider: LlmProvider
  private readonly config: VercelLlmConfig
  private readonly generate: GenerateFn

  constructor(config: VercelLlmConfig, generate: GenerateFn = createVercelGenerate(config)) {
    this.config = config
    this.provider = config.provider
    this.generate = generate
  }

  available(): Promise<boolean> {
    // Cheap config probe (no completion): hosted providers need a key, Ollama a URL.
    const configured =
      this.config.provider === 'ollama' ? Boolean(this.config.baseUrl) : Boolean(this.config.apiKey)
    return Promise.resolve(configured)
  }

  async complete(request: LlmRequest): Promise<LlmResult> {
    try {
      const reply = await this.generate({
        messages: request.messages.map(m => ({ role: m.role, content: m.content })),
        ...(request.maxOutputTokens === undefined
          ? {}
          : { maxOutputTokens: request.maxOutputTokens }),
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      })
      return {
        text: reply.text,
        usage: { inputTokens: reply.inputTokens, outputTokens: reply.outputTokens },
        provider: this.provider,
        model: this.config.model,
      }
    } catch (err) {
      if (err instanceof LlmUnavailableError) throw err
      const message = err instanceof Error ? err.message : 'LLM completion failed'
      throw new LlmUnavailableError(this.provider, message)
    }
  }
}
