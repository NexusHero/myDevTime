import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { creditEntries, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import * as credits from './credits-service.js'

/**
 * The AI-credit ledger against a REAL Postgres (SKILL §3.3): grants add, debits
 * subtract, the balance is derived, debits are idempotent on operationId and
 * refuse to overdraw, and everything is workspace-isolated. Skips without
 * DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('credit ledger (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-credits-a'
  const idB = 'itest-credits-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'credits-a@itest.local'],
      [idB, 'credits-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    await db.delete(creditEntries).where(inArray(creditEntries.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  it('GrantThenDebitDerivesTheBalanceAndUsage', async () => {
    await credits.grant(db, wsA, { amount: 500, category: 'monthly-grant' })
    await credits.debit(db, wsA, { amount: 8, category: 'meeting-insights' })
    await credits.debit(db, wsA, { amount: 2, category: 'co-planner' })
    await credits.debit(db, wsA, { amount: 3, category: 'meeting-insights' })

    expect(await credits.balanceFor(db, wsA)).toBe(500 - 8 - 2 - 3)
    const usage = await credits.usageFor(db, wsA, {
      from: new Date('2000-01-01T00:00:00Z'),
      to: new Date('2100-01-01T00:00:00Z'),
    })
    expect(usage[0]).toEqual({ category: 'meeting-insights', credits: 11 })
  })

  it('DebitIsIdempotentOnOperationId', async () => {
    await credits.grant(db, wsA, { amount: 100, category: 'monthly-grant' })
    const first = await credits.debit(db, wsA, {
      amount: 5,
      category: 'assistant',
      operationId: 'op-1',
    })
    const replay = await credits.debit(db, wsA, {
      amount: 5,
      category: 'assistant',
      operationId: 'op-1',
    })
    expect(replay.id).toBe(first.id)
    expect(await credits.balanceFor(db, wsA)).toBe(95) // billed once
  })

  it('RefusesToOverdraw', async () => {
    await credits.grant(db, wsA, { amount: 3, category: 'monthly-grant' })
    await expect(credits.debit(db, wsA, { amount: 10, category: 'assistant' })).rejects.toThrow(
      /insufficient/,
    )
  })

  it('IsScopedToTheWorkspace', async () => {
    await credits.grant(db, wsA, { amount: 500, category: 'monthly-grant' })
    expect(await credits.balanceFor(db, wsB)).toBe(0)
    expect(await credits.listLedger(db, wsB)).toEqual([])
  })

  it('GetCredits_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/billing/credits' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
