import { eq } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { workspaceMembers, workspaces } from '../../db/schema.js'

/**
 * Resolve the caller's workspace, provisioning a personal one on first use (one
 * workspace per user at 1.0). Every catalog query is scoped by the returned id,
 * so a user can only ever reach their own workspace — isolation by construction
 * (REQ-001).
 */
export async function resolveWorkspaceId(
  db: Db,
  userId: string,
  userName: string,
): Promise<string> {
  const existing = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1)
  const member = existing[0]
  if (member) return member.workspaceId

  const created = await db
    .insert(workspaces)
    .values({ name: `${userName}'s workspace` })
    .returning({ id: workspaces.id })
  const workspace = created[0]
  if (!workspace) throw new Error('failed to provision workspace')
  await db.insert(workspaceMembers).values({ workspaceId: workspace.id, userId, role: 'owner' })
  return workspace.id
}
