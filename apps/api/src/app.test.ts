import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { loadConfig } from './config.js'
import { buildApp } from './app.js'
import { MODULE_NAMES } from './core/module.js'

describe('buildApp', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'silent' }), db: null })
  })

  afterAll(async () => {
    await app.close()
  })

  it('GetHealth_Always_Returns200Ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })

  it('GetHealthReady_NoDatabase_Returns503NotConfigured', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' })

    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ status: 'not_ready', db: 'not_configured' })
  })

  it.each(MODULE_NAMES)('GetModuleStatus_%sModule_Returns200Ok', async name => {
    const res = await app.inject({ method: 'GET', url: `/api/${name}/status` })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ module: name, status: 'ok' })
  })

  it('GetUnknownRoute_Always_Returns404ProblemJson', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/does-not-exist' })

    expect(res.statusCode).toBe(404)
    expect(res.headers['content-type']).toContain('application/problem+json')
    expect(res.json()).toMatchObject({ title: 'Not Found', status: 404 })
  })

  it('Swagger_AfterBuild_DocumentsEveryModuleStatusRoute', () => {
    const spec = app.swagger()

    for (const name of MODULE_NAMES) {
      expect(spec.paths).toHaveProperty(`/api/${name}/status`)
    }
    expect(spec.paths).toHaveProperty('/health')
  })
})
