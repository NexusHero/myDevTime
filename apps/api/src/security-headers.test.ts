import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { loadConfig } from './config.js'
import { buildApp } from './app.js'

/**
 * Security-header hardening (REQ-019): every response — success and error alike —
 * carries the baseline headers set by the `onSend` hook in `buildApp`; HSTS only
 * appears when TLS is in play (production / https), never on plain local http.
 * No DB needed — the hook lives on the HTTP edge.
 */
describe('security headers', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'silent' }), db: null })
  })

  afterAll(async () => {
    await app.close()
  })

  it('GetHealth_Success_CarriesBaselineSecurityHeaders', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()')
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin')
  })

  it('GetUnknownRoute_ErrorResponse_StillCarriesSecurityHeaders', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/does-not-exist' })

    expect(res.statusCode).toBe(404)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
  })

  it('Hsts_NonProductionHttp_IsAbsent', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.headers['strict-transport-security']).toBeUndefined()
  })

  it('Hsts_Production_IsPresent', async () => {
    const prod = await buildApp({
      config: loadConfig({
        NODE_ENV: 'production',
        LOG_LEVEL: 'silent',
        AUTH_SECRET: 'x'.repeat(32),
        AUTH_BASE_URL: 'https://api.example.test',
      }),
      db: null,
    })
    const res = await prod.inject({ method: 'GET', url: '/health' })

    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains')
    await prod.close()
  })

  it('Csp_DocsRoute_IsDeliberatelyNotSet', async () => {
    // CSP is omitted on purpose (see buildApp): the Swagger UI at /docs relies on
    // inline scripts a strict CSP would break, and the API serves no other HTML.
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.headers['content-security-policy']).toBeUndefined()
  })
})
