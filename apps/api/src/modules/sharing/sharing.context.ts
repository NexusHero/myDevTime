import { Inject, Injectable } from '@nestjs/common'
import { DB, type DbToken } from '../../core/tokens.js'
import type { Db } from '../../db/client.js'
import { UnauthorizedError } from '../../errors.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import type { AuthenticatedUser } from '../auth/contract.js'

/**
 * Per-request sharing context (ADR-0025): resolves the authenticated owner to their workspace
 * (and user id) over the `DB` token. Management routes scope to the id this resolves — never one
 * from the client — so a caller can only mint or revoke links for their own workspace (ADR-0015).
 * The public Free/Busy route uses the `DB` handle directly (no user), keyed by the link token.
 */
@Injectable()
export class SharingContext {
  constructor(@Inject(DB) private readonly db: DbToken) {}

  requireDb(): Db {
    if (!this.db) throw new UnauthorizedError('Authentication is not configured')
    return this.db
  }

  async contextOf(
    user: AuthenticatedUser,
  ): Promise<{ db: Db; workspaceId: string; userId: string }> {
    const db = this.requireDb()
    const workspaceId = await resolveWorkspaceId(db, user.id, user.name)
    return { db, workspaceId, userId: user.id }
  }
}
