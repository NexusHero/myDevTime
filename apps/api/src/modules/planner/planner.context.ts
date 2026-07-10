import { Inject, Injectable } from '@nestjs/common'
import { DB, type DbToken } from '../../core/tokens.js'
import type { Db } from '../../db/client.js'
import { UnauthorizedError } from '../../errors.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import type { AuthenticatedUser } from '../auth/contract.js'

/**
 * Per-request planner context (ADR-0025): resolves the authenticated caller to
 * their workspace (and, for plan ownership, their user id) over the `DB` token.
 * Every route scopes to the id this resolves — never one from the client — so plan
 * state is workspace-isolated by construction (ADR-0015).
 */
@Injectable()
export class PlannerContext {
  constructor(@Inject(DB) private readonly db: DbToken) {}

  private requireDb(): Db {
    if (!this.db) throw new UnauthorizedError('Authentication is not configured')
    return this.db
  }

  async workspaceOf(user: AuthenticatedUser): Promise<{ db: Db; workspaceId: string }> {
    const db = this.requireDb()
    return { db, workspaceId: await resolveWorkspaceId(db, user.id, user.name) }
  }

  async contextOf(
    user: AuthenticatedUser,
  ): Promise<{ db: Db; workspaceId: string; userId: string }> {
    const { db, workspaceId } = await this.workspaceOf(user)
    return { db, workspaceId, userId: user.id }
  }
}
