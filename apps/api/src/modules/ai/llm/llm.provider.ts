import type { Provider } from '@nestjs/common'
import type { LlmPort } from './port.js'
import { NullLlm } from './null-llm.js'

/**
 * The DI token + provider that binds the configured `LlmPort` (ADR-0029). The
 * concrete adapter (`openai`/`anthropic`/`gemini`/`ollama`) is chosen by config at
 * composition time; until an adapter is wired, this resolves the `NullLlm` so AI
 * features degrade gracefully rather than fail. Consumers inject `LLM`, never a
 * vendor SDK.
 */
export const LLM = Symbol('LLM')

export const llmProvider: Provider = {
  provide: LLM,
  useFactory: (): LlmPort => {
    // Adapter selection by `LLM_PROVIDER` lands with the first real adapter; the
    // Null default keeps the AI layer honest-by-default in the meantime.
    return new NullLlm()
  },
}
