/**
 * Public contract of the `ai` module — LLM/ASR assist layer — proposals only, never authoritative (ADR-0005). M3.
 *
 * Other modules depend ONLY on this file (interfaces/types), never on the
 * module's internals; wiring happens in app.ts. The boundary test enforces it.
 */
export interface AiModule {
  readonly name: 'ai'
}
