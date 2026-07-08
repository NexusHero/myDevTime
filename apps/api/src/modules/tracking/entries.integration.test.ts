import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { timeEntries, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from './workspace.js'
import * as entries from './entries-service.js'

/**
 * Time entries against a REAL Postgres (SKILL §3.3). Covers the acceptance-
 * critical invariants of REQ-004: at-most-one-running-timer-per-workspace,
 * `source` provenance stamping, split correctness, and — as with every entity —
 * negative workspace isolation. Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('time entries (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-entry-a'
  const idB = 'itest-entry-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'entry-a@itest.local'],
      [idB, 'entry-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    await db.delete(timeEntries).where(inArray(timeEntries.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  const t = (iso: string): Date => new Date(iso)

  it('StartTimer_SecondStart_StopsThePreviousOne', async () => {
    const first = await entries.startTimer(db, wsA, idA, { startedAt: t('2026-07-08T09:00:00Z') })
    const second = await entries.startTimer(db, wsA, idA, { startedAt: t('2026-07-08T10:00:00Z') })

    const running = await entries.getRunning(db, wsA)
    expect(running?.id).toBe(second.id)

    const reloadedFirst = await entries.getEntry(db, wsA, first.id)
    expect(reloadedFirst.endedAt).toEqual(t('2026-07-08T10:00:00Z'))
    expect(second.endedAt).toBeNull()

    const all = await entries.listEntries(db, wsA)
    expect(all.filter(e => e.endedAt === null)).toHaveLength(1)
  })

  it('Source_TimerAndManual_AreStampedForProvenance', async () => {
    const timer = await entries.startTimer(db, wsA, idA, { startedAt: t('2026-07-08T09:00:00Z') })
    expect(timer.source).toBe('timer')

    const manual = await entries.createManualEntry(db, wsA, idA, {
      startedAt: t('2026-07-08T12:00:00Z'),
      endedAt: t('2026-07-08T13:00:00Z'),
    })
    expect(manual.source).toBe('manual')
  })

  it('StopTimer_RunningTimer_DerivesEndAndClearsRunning', async () => {
    await entries.startTimer(db, wsA, idA, { startedAt: t('2026-07-08T09:00:00Z') })
    const stopped = await entries.stopTimer(db, wsA, t('2026-07-08T09:30:00Z'))
    expect(stopped.endedAt).toEqual(t('2026-07-08T09:30:00Z'))
    expect(await entries.getRunning(db, wsA)).toBeNull()
    await expect(entries.stopTimer(db, wsA)).rejects.toThrow(/no running timer/)
  })

  it('CreateManualEntry_EndBeforeStart_IsRejectedByTheCore', async () => {
    await expect(
      entries.createManualEntry(db, wsA, idA, {
        startedAt: t('2026-07-08T13:00:00Z'),
        endedAt: t('2026-07-08T12:00:00Z'),
      }),
    ).rejects.toThrow(/precedes/)
  })

  it('SplitEntry_AtInteriorInstant_ProducesTwoAdjacentEntries', async () => {
    const entry = await entries.createManualEntry(db, wsA, idA, {
      startedAt: t('2026-07-08T09:00:00Z'),
      endedAt: t('2026-07-08T11:00:00Z'),
      note: 'morning',
    })
    const [first, second] = await entries.splitEntry(db, wsA, entry.id, t('2026-07-08T10:00:00Z'))

    expect(first.id).toBe(entry.id)
    expect(first.startedAt).toEqual(t('2026-07-08T09:00:00Z'))
    expect(first.endedAt).toEqual(t('2026-07-08T10:00:00Z'))
    expect(second.startedAt).toEqual(t('2026-07-08T10:00:00Z'))
    expect(second.endedAt).toEqual(t('2026-07-08T11:00:00Z'))
    expect(second.note).toBe('morning')
    expect(await entries.listEntries(db, wsA)).toHaveLength(2)
  })

  it('SplitEntry_OutsideInterval_IsRejected', async () => {
    const entry = await entries.createManualEntry(db, wsA, idA, {
      startedAt: t('2026-07-08T09:00:00Z'),
      endedAt: t('2026-07-08T11:00:00Z'),
    })
    await expect(entries.splitEntry(db, wsA, entry.id, t('2026-07-08T12:00:00Z'))).rejects.toThrow(
      /strictly inside/,
    )
  })

  it('Entry_CrossWorkspaceAccess_IsDenied', async () => {
    const a = await entries.createManualEntry(db, wsA, idA, {
      startedAt: t('2026-07-08T09:00:00Z'),
      endedAt: t('2026-07-08T10:00:00Z'),
    })
    await expect(entries.getEntry(db, wsB, a.id)).rejects.toThrow(/not found/)
    await expect(entries.deleteEntry(db, wsB, a.id)).rejects.toThrow(/not found/)
    await expect(entries.updateEntry(db, wsB, a.id, { note: 'hijack' })).rejects.toThrow(
      /not found/,
    )
    expect(await entries.getEntry(db, wsA, a.id)).toMatchObject({ id: a.id })
  })

  it('RunningTimer_IsScopedPerWorkspace', async () => {
    await entries.startTimer(db, wsA, idA, { startedAt: t('2026-07-08T09:00:00Z') })
    // B may start its own timer; A's running row must not block or leak into B.
    const bTimer = await entries.startTimer(db, wsB, idB, { startedAt: t('2026-07-08T09:00:00Z') })
    expect((await entries.getRunning(db, wsB))?.id).toBe(bTimer.id)
    expect((await entries.getRunning(db, wsA))?.endedAt).toBeNull()
  })

  it('GetEntries_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/tracking/entries' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
