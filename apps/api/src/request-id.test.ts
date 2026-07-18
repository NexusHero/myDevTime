import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { loadConfig } from './config.js'
import { buildApp } from './app.js'

/**
 * Request-id propagation (REQ-021): a well-formed inbound `x-request-id` is echoed
 * back so a client/gateway trace survives the hop; a missing or hostile one is
 * replaced by Fastify's own request id — every response ends up traceable.
 * No DB needed — the hook lives on the HTTP edge.
 */
describe('x-request-id', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'silent' }), db: null })
  })

  afterAll(async () => {
    await app.close()
  })

  it('RequestId_WellFormedInbound_IsEchoedBack', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'trace-abc.123_XYZ' },
    })

    expect(res.headers['x-request-id']).toBe('trace-abc.123_XYZ')
  })

  it('RequestId_MissingInbound_IsGenerated', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    const id = res.headers['x-request-id']
    expect(typeof id).toBe('string')
    expect((id as string).length).toBeGreaterThan(0)
  })

  it('RequestId_HostileInbound_IsReplacedNotEchoed', async () => {
    const hostile = 'bad id with spaces %0d%0a'
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': hostile },
    })

    const id = res.headers['x-request-id']
    expect(id).not.toBe(hostile)
    expect(typeof id).toBe('string')
    expect((id as string).length).toBeGreaterThan(0)
  })

  it('RequestId_OverlongInbound_IsReplaced', async () => {
    const overlong = 'a'.repeat(200)
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': overlong },
    })

    expect(res.headers['x-request-id']).not.toBe(overlong)
  })

  it('RequestId_ErrorResponse_IsStillSet', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/does-not-exist',
      headers: { 'x-request-id': 'err-trace-1' },
    })

    expect(res.statusCode).toBe(404)
    expect(res.headers['x-request-id']).toBe('err-trace-1')
  })
})
