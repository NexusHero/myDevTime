import { Inject, Injectable } from '@nestjs/common'
import { DB, type DbToken } from '../../core/tokens.js'
import type { Db } from '../../db/client.js'
import { UnauthorizedError } from '../../errors.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import type { AuthenticatedUser } from '../auth/contract.js'

/**
 * Per-request wellbeing context (ADR-0025): resolves the caller to their workspace + user id
 * over the `DB` token, so every mood read/write scopes to ids this resolves — never ones from
 * the client — keeping the most sensitive store workspace-isolated by construction.
 */
@Injectable()
export class WellbeingContext {
  constructor(@Inject(DB) private readonly db: DbToken) {}

  async contextOf(
    user: AuthenticatedUser,
  ): Promise<{ db: Db; workspaceId: string; userId: string }> {
    if (!this.db) throw new UnauthorizedError('Authentication is not configured')
    const workspaceId = await resolveWorkspaceId(this.db, user.id, user.name)
    return { db: this.db, workspaceId, userId: user.id }
  }
}
