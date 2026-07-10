/**
 * The one narrow LLM interface the app sees (ADR-0029, skill §2.2). Every provider
 * — OpenAI, Anthropic (Claude), Google Gemini, Ollama — is reached through a single
 * library-backed adapter (`./vercel-llm.ts`, ADR-0029 amended) that confines the SDK
 * types and auth to that file and translates to/from these provider-agnostic types.
 * **Nothing upstream imports a vendor type.** The LLM only *proposes* (ADR-0005): an
 * `LlmResult` is a
 * proposal/parse/explanation the deterministic core validates, never a value the
 * port itself writes anywhere. Token `usage` is uniform so the credit ledger
 * (REQ-027) prices every provider the same way.
 */

/** Launch providers (ADR-0029). `null` is the graceful-degradation default. */
export type LlmProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'null'

export interface LlmMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

export interface LlmRequest {
  readonly messages: readonly LlmMessage[]
  readonly maxOutputTokens?: number
  readonly temperature?: number
  /**
   * A JSON Schema for structured output — the shape of a *proposal* the core will
   * validate. When set, adapters request JSON conforming to it; the text is still
   * parsed and validated upstream (ADR-0005), never trusted blindly.
   */
  readonly responseSchema?: unknown
}

export interface LlmUsage {
  readonly inputTokens: number
  readonly outputTokens: number
}

export interface LlmResult {
  /** The model's raw text (or JSON string when `responseSchema` was set). */
  readonly text: string
  readonly usage: LlmUsage
  readonly provider: LlmProvider
  readonly model: string
}

/**
 * The narrow LLM port. A feature depends on this, never a vendor SDK; the concrete
 * adapter is selected by config at composition time (ADR-0029). Implementations
 * must be side-effect-free beyond the provider call and must not mutate app state.
 */
export interface LlmPort {
  readonly provider: LlmProvider
  /** Complete a request. Throws `LlmUnavailableError` when the provider is down. */
  complete(request: LlmRequest): Promise<LlmResult>
  /** Whether the provider is configured and reachable (cheap; no completion). */
  available(): Promise<boolean>
}

/**
 * Thrown when no provider is configured or the chosen one is unreachable. Every AI
 * feature must handle this and degrade — the deterministic core never depends on
 * the LLM being up (ADR-0005/0029).
 */
export class LlmUnavailableError extends Error {
  readonly provider: LlmProvider
  constructor(provider: LlmProvider, message = 'LLM provider is not available') {
    super(message)
    this.name = 'LlmUnavailableError'
    this.provider = provider
  }
}
