import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../../config.js'
import { createDb, type DbHandle } from '../../db/client.js'
import { buildApp } from '../../app.js'

/**
 * The Reports/analytics export endpoint (REQ-045), wired end-to-end through the real Nest/Fastify
 * app. The serialisers themselves are exhaustively unit-tested (`export/reports-pdf.test.ts`,
 * `packages/domain/.../export.test.ts`); here we prove the route is registered and — because it
 * returns the caller's own figures — sits behind `AuthGuard`, so an unauthenticated request is
 * rejected (401) rather than silently served. Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('tracking reports export (integration)', () => {
  let handle: DbHandle
  let app: Awaited<ReturnType<typeof buildApp>>

  const body = {
    range: 'week',
    totalMs: 9_000_000,
    billableMs: 7_200_000,
    billableMinor: 12_345,
    currencyCode: 'EUR',
    overtimeMs: -1_800_000,
    projects: [{ name: 'Finanzo', trackedMs: 5_400_000 }],
    budgets: [{ name: 'Q3', consumedMinor: 50_000, ratio: 0.732, currencyCode: 'EUR' }],
  }

  beforeAll(async () => {
    handle = createDb(databaseUrl!)
    app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
  })

  afterAll(async () => {
    await app.close()
    await handle.close()
  })

  it('ExportCsv_Unauthenticated_Returns401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tracking/reports/export?format=csv',
      payload: body,
    })

    expect(res.statusCode).toBe(401)
  })

  it('ExportPdf_Unauthenticated_Returns401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tracking/reports/export?format=pdf',
      payload: body,
    })

    expect(res.statusCode).toBe(401)
  })
})
