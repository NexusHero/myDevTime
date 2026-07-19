import { Injectable } from '@nestjs/common'

/**
 * Canonical names of the operational counters (REQ-021). Exported so any module
 * that produces a signal — the request interceptor here, or the `ai` module
 * recording an LLM call / credit spend — increments the SAME string, and the
 * metrics endpoint reads it back. New signals add a name here; nothing else
 * hard-codes the raw string.
 */
export const METRIC = {
  requestsTotal: 'requests.total',
  requestsOk: 'requests.ok',
  requestsClientError: 'requests.clientError',
  requestsServerError: 'requests.serverError',
  aiCalls: 'ai.calls',
  aiCreditsSpent: 'ai.creditsSpent',
} as const

export type MetricName = (typeof METRIC)[keyof typeof METRIC]

/** The counters seeded to 0 at construction, so a fresh process reports them explicitly. */
const SEEDED: readonly string[] = Object.values(METRIC)

/**
 * A tiny, framework-free in-process counter registry (REQ-021). Deterministic and
 * unit-testable by construction: a single `Map<string, number>`, monotonically
 * incremented, never mutating state anywhere else. It holds NO business numbers
 * (those live in `packages/domain`, ADR-0005) — only operational tallies that are
 * lost on restart, which is exactly what a metrics snapshot is for. Other modules
 * inject this and call `increment(name, by)`; the metrics endpoint calls `get`.
 */
@Injectable()
export class CounterService {
  private readonly counters = new Map<string, number>()

  constructor() {
    for (const name of SEEDED) this.counters.set(name, 0)
  }

  /** Add `by` (default 1) to the named counter, creating it at 0 if unseen. */
  increment(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by)
  }

  /** The current value of a counter; an unknown counter reads as 0, never undefined. */
  get(name: string): number {
    return this.counters.get(name) ?? 0
  }

  /** A flat copy of every counter — for ad-hoc inspection/debugging, not the wire shape. */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters)
  }
}
