import { eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client.js'
import { workspaceMembers, workspaces } from '../db/schema.js'

/**
 * Resolve the caller's workspace, provisioning a personal one on first use (one
 * workspace per user at 1.0). Shared infrastructure — both the `tracking` and
 * `sync` modules scope every query by the returned id, so a user can only ever
 * reach their own workspace (isolation by construction, REQ-001). Lives in
 * `core/` so neither module imports the other (the boundary rule).
 */
export async function resolveWorkspaceId(
  db: Db,
  userId: string,
  userName: string,
): Promise<string> {
  // This runs on the first request of every module, so two concurrent first
  // requests could both find no membership and both provision a workspace. Wrap
  // the read-then-insert in one transaction guarded by a per-user advisory lock
  // so the second caller blocks, then sees the row the first inserted — one
  // personal workspace per user, even under a concurrent cold start.
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`)
    const existing = await tx
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId))
      .limit(1)
    const member = existing[0]
    if (member) return member.workspaceId

    const created = await tx
      .insert(workspaces)
      .values({ name: `${userName}'s workspace` })
      .returning({ id: workspaces.id })
    const workspace = created[0]
    if (!workspace) throw new Error('failed to provision workspace')
    await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId, role: 'owner' })
    return workspace.id
  })
}
