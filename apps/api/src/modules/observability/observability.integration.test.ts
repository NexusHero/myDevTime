import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../config.js'
import { buildApp } from '../../app.js'
import { CounterService, METRIC } from './counter.service.js'
import { ObservabilityController } from './observability.controller.js'

/**
 * The observability HTTP surface (REQ-021): the controller projects the live counters
 * into the wire shape, and the endpoint is guarded like every other data route — an
 * unauthenticated caller gets a 401 (problem+json via the filter). The guard check
 * needs no DB: with `db: null` the auth instance is null and the guard rejects, so this
 * runs everywhere (no DATABASE_URL required).
 */
describe('ObservabilityController', () => {
  it('ProjectsLiveCountersIntoTheSnapshot', () => {
    const counters = new CounterService()
    counters.increment(METRIC.requestsTotal, 2)
    counters.increment(METRIC.requestsOk)
    counters.increment(METRIC.aiCalls, 3)
    const controller = new ObservabilityController(counters)

    const snap = controller.metrics()

    expect(snap.requests.total).toBe(2)
    expect(snap.requests.ok).toBe(1)
    expect(snap.ai.calls).toBe(3)
    expect(snap.uptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(snap.collectedAtMs).toBeGreaterThan(0)
  })
})

describe('observability (HTTP guard)', () => {
  it('GetMetrics_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: null,
    })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/observability/metrics' })
      expect(res.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })
})
