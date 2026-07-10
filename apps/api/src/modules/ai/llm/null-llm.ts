import { LlmUnavailableError, type LlmPort, type LlmRequest, type LlmResult } from './port.js'

/**
 * The graceful-degradation default (ADR-0029): the `LlmPort` used when no provider
 * is configured or none is reachable. `available()` is always false and
 * `complete()` refuses with `LlmUnavailableError`, so AI features fall back to
 * their non-AI path and the deterministic core is untouched (ADR-0005). It is also
 * the seam features test against before any real key exists.
 */
export class NullLlm implements LlmPort {
  readonly provider = 'null' as const

  complete(_request: LlmRequest): Promise<LlmResult> {
    return Promise.reject(new LlmUnavailableError('null', 'no LLM provider configured'))
  }

  available(): Promise<boolean> {
    return Promise.resolve(false)
  }
}
