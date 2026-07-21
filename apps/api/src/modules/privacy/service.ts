import { and, eq, isNotNull, lt } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import {
  absencePolicies,
  absences,
  attendanceShifts,
  billingCustomers,
  budgetAlerts,
  budgets,
  clients,
  connectorGrants,
  connectorTokens,
  creditEntries,
  entitlementEvents,
  invoices,
  partnerShares,
  plans,
  projects,
  protectedTimes,
  rates,
  recurringEntries,
  rules,
  syncConflicts,
  syncOperations,
  tags,
  tasks,
  timeEntries,
  user,
  userPreferences,
  verification,
  wellbeingMoods,
  workSchedules,
  workspaceMembers,
  workspaces,
} from '../../db/schema.js'
import { NotFoundError } from '../../errors.js'

/**
 * GDPR service (REQ-020): data portability (Art. 20 — a complete machine-readable export of
 * the caller's workspace), the right to erasure (Art. 17 — account + workspace deletion), and
 * storage limitation (Art. 5(1)(e) — hard-purge of expired soft-deleted tombstones). Every
 * function takes the `workspaceId` non-optionally and scopes every query by it, so a caller
 * can only ever export or erase their OWN data (ADR-0015 isolation by construction). All of it
 * is plain deterministic persistence — no AI touches this path (ADR-0005).
 */

/** The caller's identity row minus nothing secret — `user` holds no credentials
 *  (passwords/OAuth tokens live in `account`, which is auth-internal and excluded). */
export interface ExportedUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: Date
  updatedAt: Date
}

export type WorkspaceExport = Awaited<ReturnType<typeof exportWorkspaceData>>

/**
 * Assemble the complete JSON export of the caller's workspace (REQ-020): the `user` and
 * `workspaces` rows plus every row of every workspace-scoped table, keyed by table name.
 * Soft-deleted tombstones are included on purpose — they are still stored personal data, so a
 * complete export must show them. Auth-internal tables (`session`, `account`, `verification`)
 * are excluded: they hold credentials/secrets, not user content. Connector token rows are
 * exported as metadata only — the sealed OAuth ciphertext (ADR-0032/0033) is stripped, since
 * secret material has no place in a portability export.
 */
export async function exportWorkspaceData(db: Db, workspaceId: string, userId: string) {
  const userRows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
  const caller: ExportedUser | undefined = userRows[0]
  if (!caller) throw new NotFoundError('user not found')

  const workspaceRows = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId))
  const workspace = workspaceRows[0]
  if (!workspace) throw new NotFoundError('workspace not found')

  const data = {
    workspaceMembers: await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId)),
    clients: await db.select().from(clients).where(eq(clients.workspaceId, workspaceId)),
    projects: await db.select().from(projects).where(eq(projects.workspaceId, workspaceId)),
    tasks: await db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId)),
    tags: await db.select().from(tags).where(eq(tags.workspaceId, workspaceId)),
    timeEntries: await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.workspaceId, workspaceId)),
    syncOperations: await db
      .select()
      .from(syncOperations)
      .where(eq(syncOperations.workspaceId, workspaceId)),
    syncConflicts: await db
      .select()
      .from(syncConflicts)
      .where(eq(syncConflicts.workspaceId, workspaceId)),
    rates: await db.select().from(rates).where(eq(rates.workspaceId, workspaceId)),
    budgets: await db.select().from(budgets).where(eq(budgets.workspaceId, workspaceId)),
    budgetAlerts: await db
      .select()
      .from(budgetAlerts)
      .where(eq(budgetAlerts.workspaceId, workspaceId)),
    invoices: await db.select().from(invoices).where(eq(invoices.workspaceId, workspaceId)),
    entitlementEvents: await db
      .select()
      .from(entitlementEvents)
      .where(eq(entitlementEvents.workspaceId, workspaceId)),
    billingCustomers: await db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.workspaceId, workspaceId)),
    attendanceShifts: await db
      .select()
      .from(attendanceShifts)
      .where(eq(attendanceShifts.workspaceId, workspaceId)),
    workSchedules: await db
      .select()
      .from(workSchedules)
      .where(eq(workSchedules.workspaceId, workspaceId)),
    absences: await db.select().from(absences).where(eq(absences.workspaceId, workspaceId)),
    absencePolicies: await db
      .select()
      .from(absencePolicies)
      .where(eq(absencePolicies.workspaceId, workspaceId)),
    plans: await db.select().from(plans).where(eq(plans.workspaceId, workspaceId)),
    creditEntries: await db
      .select()
      .from(creditEntries)
      .where(eq(creditEntries.workspaceId, workspaceId)),
    userPreferences: await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.workspaceId, workspaceId)),
    // Metadata only — the sealed access/refresh token ciphertext is deliberately dropped.
    connectorTokens: await db
      .select({
        id: connectorTokens.id,
        workspaceId: connectorTokens.workspaceId,
        userId: connectorTokens.userId,
        connector: connectorTokens.connector,
        expiresAt: connectorTokens.expiresAt,
        scopes: connectorTokens.scopes,
        updatedAt: connectorTokens.updatedAt,
      })
      .from(connectorTokens)
      .where(eq(connectorTokens.workspaceId, workspaceId)),
    connectorGrants: await db
      .select()
      .from(connectorGrants)
      .where(eq(connectorGrants.workspaceId, workspaceId)),
    recurringEntries: await db
      .select()
      .from(recurringEntries)
      .where(eq(recurringEntries.workspaceId, workspaceId)),
    partnerShares: await db
      .select()
      .from(partnerShares)
      .where(eq(partnerShares.workspaceId, workspaceId)),
    rules: await db.select().from(rules).where(eq(rules.workspaceId, workspaceId)),
    // Confirmed 🛡 protect-time windows (REQ-070) — planner data like `plans`, so the
    // "every workspace-scoped table" contract covers them the same way.
    protectedTimes: await db
      .select()
      .from(protectedTimes)
      .where(eq(protectedTimes.workspaceId, workspaceId)),
    // The consented mood memory (REQ-068) — the most sensitive datum here, so only the
    // CALLER's own rows travel, reduced to the personal data itself (day + word). Consent
    // gates capture and API reads; a portability export of one's own stored data is the
    // one read that must work regardless (GDPR Art. 20).
    wellbeingMoods: await db
      .select({ day: wellbeingMoods.day, mood: wellbeingMoods.mood })
      .from(wellbeingMoods)
      .where(and(eq(wellbeingMoods.workspaceId, workspaceId), eq(wellbeingMoods.userId, userId))),
  }

  return {
    exportedAt: new Date().toISOString(),
    user: caller,
    workspace,
    data,
  }
}

/**
 * Right to erasure (REQ-020, GDPR Art. 17): hard-delete the caller's workspace and identity.
 * Every workspace-scoped table carries `onDelete: 'cascade'` on its `workspace_id` FK (verified
 * against the schema files), so deleting the `workspaces` row removes ALL tenant data in one
 * statement. The Better-Auth rows follow: `session` and `account` cascade from `user`;
 * `verification` has no FK (it is keyed by `identifier` = the email), so its rows are deleted
 * explicitly before the `user` row goes. One personal workspace per user at 1.0, so this is a
 * complete account wipe.
 */
export async function eraseAccount(db: Db, workspaceId: string, userId: string): Promise<void> {
  const userRows = await db.select({ email: user.email }).from(user).where(eq(user.id, userId))
  const caller = userRows[0]
  if (!caller) throw new NotFoundError('user not found')

  await db.transaction(async tx => {
    // Cascades: workspace_members, clients, projects, tasks, tags, time_entries,
    // sync_operations, sync_conflicts, rates, budgets (→ budget_alerts), invoices,
    // entitlement_events, billing_customers, attendance_shifts, work_schedules,
    // absences, absence_policies, plans, protected_times, credit_entries,
    // user_preferences, connector_tokens, connector_grants, recurring_entries,
    // partner_shares, rules, wellbeing_days, wellbeing_moods.
    await tx.delete(workspaces).where(eq(workspaces.id, workspaceId))
    // No FK from `verification` to `user` — remove pending verification/reset rows by email.
    await tx.delete(verification).where(eq(verification.identifier, caller.email))
    // Cascades: session, account (and any lingering user-FK rows in other workspaces).
    await tx.delete(user).where(eq(user.id, userId))
  })
}

/**
 * Pure retention arithmetic (REQ-020 storage limitation): the instant before which a
 * soft-deleted row has outlived its retention window. Day-based, timezone-free: exactly
 * `days × 24h` before `now`, so the same inputs always give the same cutoff (ADR-0005 —
 * deterministic, exhaustively unit-tested).
 */
export function retentionCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000)
}

/** Per-table purge counts, keyed by the export's table names. */
export interface PurgeResult {
  timeEntries: number
  tasks: number
  projects: number
  clients: number
  tags: number
  rules: number
}

/**
 * Hard-delete soft-deleted tombstones older than the retention window (REQ-020). Covers every
 * table that carries `deleted_at` (grepped from the schema): `time_entries`, `tasks`,
 * `projects`, `clients`, `tags`, `rules`. Children are purged before parents so the per-table
 * counts stay honest (an expired project would otherwise cascade-delete its expired tasks
 * before they are counted). Rows with `deleted_at` NULL — live data — are never touched.
 */
export async function purgeSoftDeleted(
  db: Db,
  workspaceId: string,
  olderThanDays: number,
  now: Date = new Date(),
): Promise<PurgeResult> {
  const cutoff = retentionCutoff(now, olderThanDays)
  return db.transaction(async tx => {
    const purgedTimeEntries = await tx
      .delete(timeEntries)
      .where(
        and(
          eq(timeEntries.workspaceId, workspaceId),
          isNotNull(timeEntries.deletedAt),
          lt(timeEntries.deletedAt, cutoff),
        ),
      )
      .returning({ id: timeEntries.id })
    const purgedTasks = await tx
      .delete(tasks)
      .where(
        and(
          eq(tasks.workspaceId, workspaceId),
          isNotNull(tasks.deletedAt),
          lt(tasks.deletedAt, cutoff),
        ),
      )
      .returning({ id: tasks.id })
    const purgedProjects = await tx
      .delete(projects)
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          isNotNull(projects.deletedAt),
          lt(projects.deletedAt, cutoff),
        ),
      )
      .returning({ id: projects.id })
    const purgedClients = await tx
      .delete(clients)
      .where(
        and(
          eq(clients.workspaceId, workspaceId),
          isNotNull(clients.deletedAt),
          lt(clients.deletedAt, cutoff),
        ),
      )
      .returning({ id: clients.id })
    const purgedTags = await tx
      .delete(tags)
      .where(
        and(
          eq(tags.workspaceId, workspaceId),
          isNotNull(tags.deletedAt),
          lt(tags.deletedAt, cutoff),
        ),
      )
      .returning({ id: tags.id })
    const purgedRules = await tx
      .delete(rules)
      .where(
        and(
          eq(rules.workspaceId, workspaceId),
          isNotNull(rules.deletedAt),
          lt(rules.deletedAt, cutoff),
        ),
      )
      .returning({ id: rules.id })
    return {
      timeEntries: purgedTimeEntries.length,
      tasks: purgedTasks.length,
      projects: purgedProjects.length,
      clients: purgedClients.length,
      tags: purgedTags.length,
      rules: purgedRules.length,
    }
  })
}
