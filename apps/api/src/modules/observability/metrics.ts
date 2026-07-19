import { HttpException } from '@nestjs/common'
import { AppError } from '../../errors.js'
import { METRIC } from './counter.service.js'
import type { CounterService } from './counter.service.js'

/** The metrics wire shape returned by `GET /api/observability/metrics` (REQ-021). */
export interface MetricsSnapshot {
  requests: {
    total: number
    ok: number
    clientError: number
    serverError: number
  }
  ai: {
    calls: number
    creditsSpent: number
  }
  uptimeSeconds: number
  collectedAtMs: number
}

export type StatusClassMetric =
  typeof METRIC.requestsOk | typeof METRIC.requestsClientError | typeof METRIC.requestsServerError

/**
 * Bucket an HTTP status code into its counter (pure, exhaustively testable): 5xx →
 * serverError, 4xx → clientError, everything else (2xx/3xx) → ok. Kept a total
 * function so no status can ever go uncounted.
 */
export function statusClassMetric(status: number): StatusClassMetric {
  if (status >= 500) return METRIC.requestsServerError
  if (status >= 400) return METRIC.requestsClientError
  return METRIC.requestsOk
}

/**
 * The status a thrown error will resolve to on the wire — mirrors `ProblemDetailsFilter`
 * exactly: typed `AppError` keeps its status, a Nest `HttpException` its `getStatus()`,
 * anything else is an unhandled 500. Keeping this in lockstep with the filter means the
 * status-class counters match the statuses clients actually observe.
 */
export function statusOfError(err: unknown): number {
  if (err instanceof AppError) return err.status
  if (err instanceof HttpException) return err.getStatus()
  return 500
}

/** A read of "now" for the snapshot — injected so `buildSnapshot` stays pure/testable. */
export interface MetricsClock {
  uptimeSeconds: number
  collectedAtMs: number
}

/** Assemble the wire snapshot from the counter registry and a clock read (pure). */
export function buildSnapshot(counters: CounterService, clock: MetricsClock): MetricsSnapshot {
  return {
    requests: {
      total: counters.get(METRIC.requestsTotal),
      ok: counters.get(METRIC.requestsOk),
      clientError: counters.get(METRIC.requestsClientError),
      serverError: counters.get(METRIC.requestsServerError),
    },
    ai: {
      calls: counters.get(METRIC.aiCalls),
      creditsSpent: counters.get(METRIC.aiCreditsSpent),
    },
    uptimeSeconds: clock.uptimeSeconds,
    collectedAtMs: clock.collectedAtMs,
  }
}
