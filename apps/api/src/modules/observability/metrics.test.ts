import { HttpException, HttpStatus } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { NotFoundError, UnauthorizedError, ValidationError } from '../../errors.js'
import { CounterService, METRIC } from './counter.service.js'
import { buildSnapshot, statusClassMetric, statusOfError } from './metrics.js'

/** Pure metrics helpers (REQ-021): status bucketing, error→status, snapshot assembly. */
describe('statusClassMetric', () => {
  it.each([
    [200, METRIC.requestsOk],
    [201, METRIC.requestsOk],
    [204, METRIC.requestsOk],
    [302, METRIC.requestsOk],
    [400, METRIC.requestsClientError],
    [401, METRIC.requestsClientError],
    [404, METRIC.requestsClientError],
    [429, METRIC.requestsClientError],
    [500, METRIC.requestsServerError],
    [503, METRIC.requestsServerError],
  ])('buckets %i into %s', (status, expected) => {
    expect(statusClassMetric(status)).toBe(expected)
  })
})

describe('statusOfError', () => {
  it('UsesTheStatusOfATypedAppError', () => {
    expect(statusOfError(new UnauthorizedError())).toBe(401)
    expect(statusOfError(new NotFoundError())).toBe(404)
    expect(statusOfError(new ValidationError())).toBe(400)
  })

  it('UsesGetStatusForANestHttpException', () => {
    expect(statusOfError(new HttpException('nope', HttpStatus.FORBIDDEN))).toBe(403)
  })

  it('FallsBackToFiveHundredForAnUnknownError', () => {
    expect(statusOfError(new Error('boom'))).toBe(500)
    expect(statusOfError('not-an-error')).toBe(500)
  })
})

describe('buildSnapshot', () => {
  it('ProjectsTheCountersAndClockIntoTheWireShape', () => {
    const counters = new CounterService()
    counters.increment(METRIC.requestsTotal, 3)
    counters.increment(METRIC.requestsOk, 2)
    counters.increment(METRIC.requestsClientError)
    counters.increment(METRIC.aiCalls, 7)
    counters.increment(METRIC.aiCreditsSpent, 12)

    const snap = buildSnapshot(counters, { uptimeSeconds: 42, collectedAtMs: 1_000 })

    expect(snap).toEqual({
      requests: { total: 3, ok: 2, clientError: 1, serverError: 0 },
      ai: { calls: 7, creditsSpent: 12 },
      uptimeSeconds: 42,
      collectedAtMs: 1_000,
    })
  })
})
