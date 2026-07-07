import { afterAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../config.js'
import { createDb } from './client.js'
import { buildApp } from '../app.js'

/**
 * Readiness against a REAL Postgres (SKILL §3.3 — only genuinely external
 * systems are exercised at this layer). Skips when DATABASE_URL is unset, so the
 * pure local gate runs without a database; CI provides a `postgres` service.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('GET /health/ready (integration)', () => {
  const handle = createDb(databaseUrl!)

  afterAll(async () => {
    await handle.close()
  })

  it('GetHealthReady_DatabaseReachable_Returns200Ready', async () => {
    const app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'silent' }), db: handle })

    const res = await app.inject({ method: 'GET', url: '/health/ready' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ready', db: 'up' })
    await app.close()
  })
})
