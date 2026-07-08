import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Db } from '../../db/client.js'
import { UnauthorizedError } from '../../errors.js'
import { resolveWorkspaceId } from './workspace.js'

/**
 * Per-request tracking context: resolves the authenticated caller to their
 * workspace (provisioning one on first use) and, where an entry needs an owner,
 * their user id. Isolation is enforced by construction — a route can only ever
 * act on the workspace this resolves, never one supplied by the client.
 */
export interface TrackingContext {
  /** The caller's workspace id. */
  readonly workspaceOf: (request: FastifyRequest) => Promise<string>
  /** The caller's workspace id and user id (for entry ownership). */
  readonly contextOf: (request: FastifyRequest) => Promise<{ workspaceId: string; userId: string }>
}

export function createTrackingContext(db: Db): TrackingContext {
  const contextOf = async (
    request: FastifyRequest,
  ): Promise<{ workspaceId: string; userId: string }> => {
    const authUser = request.authUser
    if (!authUser) throw new UnauthorizedError('Authentication required')
    const workspaceId = await resolveWorkspaceId(db, authUser.id, authUser.name)
    return { workspaceId, userId: authUser.id }
  }
  return {
    contextOf,
    workspaceOf: async request => (await contextOf(request)).workspaceId,
  }
}

/** PreHandler that requires an authenticated session (decorated at the root). */
export const guard = (
  instance: FastifyInstance,
): { preHandler: [typeof instance.requireAuth] } => ({
  preHandler: [instance.requireAuth],
})
