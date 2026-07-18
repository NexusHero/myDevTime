import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../tracking/workspace.js'
import * as svc from './service.js'

/**
 * Categorization rules against a REAL Postgres (REQ-011, ADR-0005). Covers the acceptance-critical
 * invariants: the CRUD round-trip persists the JSON `matcher`/`action`, a **dry-run writes nothing**
 * and its verdicts come straight from the deterministic engine, the version bumps on every update,
 * negative workspace isolation (A's rules are invisible/untouchable from B), and the guard rejects
 * unauthenticated callers. Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('automation rules (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-rules-a'
  const idB = 'itest-rules-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'rules-a@itest.local'],
      [idB, 'rules-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  it('Rule_CrudRoundTrip_PersistsMatcherAndAction', async () => {
    const created = await svc.createRule(db, wsA, {
      order: 1,
      matcher: { noteContains: 'standup', sourceIs: 'calendar' },
      action: { setProjectId: 'proj-1', addTags: ['meeting'] },
      enabled: true,
    })
    expect(created.version).toBe(1)
    expect(created.matcher).toEqual({ noteContains: 'standup', sourceIs: 'calendar' })
    expect(created.action).toEqual({ setProjectId: 'proj-1', addTags: ['meeting'] })

    const fetched = await svc.getRule(db, wsA, created.id)
    expect(fetched.matcher).toEqual(created.matcher)

    const listed = await svc.listRules(db, wsA)
    expect(listed.some(r => r.id === created.id)).toBe(true)
  })

  it('Rule_Update_BumpsVersionAndNormalizesMatcher', async () => {
    const created = await svc.createRule(db, wsA, {
      order: 2,
      matcher: { noteContains: 'sync' },
      action: { setBillable: false },
    })
    const updated = await svc.updateRule(db, wsA, created.id, {
      matcher: { noteContains: 'sync', projectIsEmpty: true },
      action: { setBillable: true },
    })
    expect(updated.version).toBe(2)
    expect(updated.matcher).toEqual({ noteContains: 'sync', projectIsEmpty: true })
    expect(updated.action).toEqual({ setBillable: true })
  })

  it('Rule_Delete_SoftHidesFromList', async () => {
    const created = await svc.createRule(db, wsA, { matcher: { noteContains: 'gone' } })
    await svc.deleteRule(db, wsA, created.id)
    const listed = await svc.listRules(db, wsA)
    expect(listed.some(r => r.id === created.id)).toBe(false)
    await expect(svc.getRule(db, wsA, created.id)).rejects.toThrow(/not found/)
  })

  it('Rule_DryRun_WritesNothingAndProposesFromEngine', async () => {
    // A rule that fills an empty project when the note mentions "review". Dry-run must propose it
    // for the matching subject and leave the other untouched — and persist nothing.
    const rule = await svc.createRule(db, wsA, {
      order: 10,
      matcher: { noteContains: 'review', projectIsEmpty: true },
      action: { setProjectId: 'proj-review' },
    })
    const before = await svc.listRules(db, wsA)
    const rows = await svc.dryRunRules(db, wsA, [
      { key: 'e1', subject: { note: 'code review', projectId: null } },
      { key: 'e2', subject: { note: 'lunch', projectId: 'proj-x' } },
    ])
    const e1 = rows.find(r => r.key === 'e1')
    const e2 = rows.find(r => r.key === 'e2')
    expect(e1?.match?.action).toEqual({ setProjectId: 'proj-review' })
    expect(e1?.match?.ruleId).toBe(rule.id)
    expect(e1?.match?.provenance).toBe(`rule:${rule.id}@1`)
    expect(e2?.match ?? null).toBeNull()
    // Dry-run is read-only: the rule set is unchanged.
    const after = await svc.listRules(db, wsA)
    expect(after.length).toBe(before.length)
  })

  it('Rule_CrossWorkspaceAccess_IsDenied', async () => {
    const a = await svc.createRule(db, wsA, { matcher: { noteContains: 'secret' } })
    await svc.createRule(db, wsB, { matcher: { noteContains: 'other' } })

    const listA = await svc.listRules(db, wsA)
    expect(listA.some(r => r.matcher.noteContains === 'other')).toBe(false)

    await expect(svc.getRule(db, wsB, a.id)).rejects.toThrow(/not found/)
    await expect(svc.updateRule(db, wsB, a.id, { action: { setBillable: true } })).rejects.toThrow(
      /not found/,
    )
    await expect(svc.deleteRule(db, wsB, a.id)).rejects.toThrow(/not found/)
  })

  it('ListRules_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/automation/rules' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
