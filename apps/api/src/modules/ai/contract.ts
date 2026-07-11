/**
 * Public contract of the `ai` module — LLM/ASR assist layer — proposals only, never authoritative (ADR-0005). M3.
 *
 * Other modules depend ONLY on this file (interfaces/types), never on the
 * module's internals; wiring happens in app.ts. The boundary test enforces it.
 */
export interface AiModule {
  readonly name: 'ai'
}

/**
 * The LLM seam other modules may consume (ADR-0029): the `LLM` DI token + its
 * provider, the narrow `LlmPort` type, and the typed unavailability error. The
 * concrete adapters stay private to the `ai` module.
 */
export { LLM, llmProvider } from './llm/llm.provider.js'
export { LlmUnavailableError } from './llm/port.js'
export type { LlmPort, LlmRequest, LlmResult, LlmProvider } from './llm/port.js'
