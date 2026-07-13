import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../config.js'
import { buildApp } from '../../app.js'

/**
 * The shared `AuthGuard` (ADR-0025) is the cross-module auth seam: any protected
 * module uses `@UseGuards(AuthGuard)` by importing `AuthModule`, replacing the
 * old Fastify `requireAuth` decorator. Verifiable without a database — an
 * unauthenticated request to a protected route in another module must be refused
 * (401 problem+json), proving the guard is wired app-wide.
 */
describe('auth guard wiring', () => {
  it('ProtectedRoutes_Unauthenticated_Return401ProblemJson', async () => {
    const app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'silent' }), db: null })

    for (const url of ['/api/tracking/clients', '/api/billing/rates']) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode).toBe(401)
      expect(res.headers['content-type']).toContain('application/problem+json')
    }

    await app.close()
  })
})
