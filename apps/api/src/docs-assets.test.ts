import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { loadConfig } from './config.js'
import { buildApp } from './app.js'

/**
 * The Swagger UI at `/docs` (ADR-0025) serves its static assets through
 * `@fastify/static`, whose `glob` is lifted to a patched major by a `resolutions`
 * override (docs/security/audit-exceptions.md). Pinned here: the page and its
 * bundled assets are still served, so that override can never silently break it.
 */
describe('docs static assets', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'silent' }), db: null })
  })

  afterAll(async () => {
    await app.close()
  })

  it('GetDocs_SwaggerUi_ServesThePage', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('swagger-ui')
  })

  it.each(['swagger-ui.css', 'swagger-ui-bundle.js'])(
    'GetDocsAsset_%s_IsServedFromTheStaticRoot',
    async asset => {
      const res = await app.inject({ method: 'GET', url: `/docs/${asset}` })

      expect(res.statusCode).toBe(200)
      expect(res.body.length).toBeGreaterThan(1_000)
    },
  )
})
