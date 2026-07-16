import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { userPreferences, workspaces } from '../../db/schema.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import * as prefs from './service.js'

/**
 * Preference persistence against a REAL Postgres (M10 + REQ-044). Focuses on the
 * durable, cross-device `onboarded` flag that replaced the in-memory native gate
 * flag (audit M11): it defaults false, round-trips true through the upsert without
 * resetting the other toggles, and — like every entity — is workspace-isolated.
 * Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('preferences (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-prefs-a'
  const idB = 'itest-prefs-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'prefs-a@itest.local'],
      [idB, 'prefs-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    await db.delete(userPreferences).where(inArray(userPreferences.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  it('Onboarded_DefaultsFalseForAFreshUser', async () => {
    expect((await prefs.getPreferences(db, wsA, idA)).onboarded).toBe(false)
  })

  it('Onboarded_RoundTripsTrueAndSurvivesAReread', async () => {
    await prefs.setPreferences(db, wsA, idA, { onboarded: true })
    expect((await prefs.getPreferences(db, wsA, idA)).onboarded).toBe(true)
  })

  it('Onboarded_MergesWithoutResettingOtherToggles', async () => {
    await prefs.setPreferences(db, wsA, idA, { autoTracker: true })
    const merged = await prefs.setPreferences(db, wsA, idA, { onboarded: true })
    expect(merged.onboarded).toBe(true)
    expect(merged.autoTracker).toBe(true) // earlier patch preserved by the upsert merge
  })

  it('Onboarded_IsWorkspaceIsolated', async () => {
    await prefs.setPreferences(db, wsA, idA, { onboarded: true })
    expect((await prefs.getPreferences(db, wsB, idB)).onboarded).toBe(false)
  })
})
