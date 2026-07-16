import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { timeEntries, workspaces } from '../../db/schema.js'
import { resolveWorkspaceId } from './workspace.js'
import * as entries from './entries-service.js'

/**
 * Note search (REQ-036) against a REAL Postgres: the `q` filter finds entries by a
 * case-insensitive note substring, treats `%`/`_` literally (no wildcard
 * injection), returns everything when blank, and — like every entity query — is
 * workspace-isolated. Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('entry note search (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-search-a'
  const idB = 'itest-search-b'
  let wsA = ''
  let wsB = ''

  const t = (iso: string): Date => new Date(iso)

  async function seed(ws: string, userId: string, note: string, hour: number): Promise<void> {
    await entries.createManualEntry(db, ws, userId, {
      startedAt: t(`2026-07-08T${String(hour).padStart(2, '0')}:00:00Z`),
      endedAt: t(`2026-07-08T${String(hour).padStart(2, '0')}:30:00Z`),
      note,
    })
  }

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'search-a@itest.local'],
      [idB, 'search-b@itest.local'],
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

  it('ListEntries_Query_ReturnsOnlyNoteMatchesCaseInsensitive', async () => {
    await seed(wsA, idA, 'Finanzo invoice fix', 9)
    await seed(wsA, idA, 'Design review', 10)
    await seed(wsA, idA, 'finanzo follow-up call', 11)

    const hits = await entries.listEntries(db, wsA, { q: 'FINANZO' })

    expect(hits.map(e => e.note).sort()).toEqual(['Finanzo invoice fix', 'finanzo follow-up call'])
  })

  it('ListEntries_BlankOrAbsentQuery_ReturnsAll', async () => {
    await seed(wsA, idA, 'one', 9)
    await seed(wsA, idA, 'two', 10)

    expect(await entries.listEntries(db, wsA, {})).toHaveLength(2)
    expect(await entries.listEntries(db, wsA, { q: '   ' })).toHaveLength(2)
  })

  it('ListEntries_Query_TreatsLikeWildcardsLiterally', async () => {
    await seed(wsA, idA, '100% billable', 9)
    await seed(wsA, idA, 'partly billable', 10)

    // '%' must match the literal percent sign, not act as a SQL wildcard.
    const hits = await entries.listEntries(db, wsA, { q: '100%' })

    expect(hits.map(e => e.note)).toEqual(['100% billable'])
  })

  it('ListEntries_Query_IsWorkspaceIsolated', async () => {
    await seed(wsA, idA, 'Finanzo secret note', 9)
    await seed(wsB, idB, 'Finanzo secret note', 9)

    const hits = await entries.listEntries(db, wsB, { q: 'finanzo' })

    expect(hits).toHaveLength(1)
    expect(hits.every(e => e.workspaceId === wsB)).toBe(true)
  })
})
