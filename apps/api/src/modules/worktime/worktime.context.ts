import { Inject, Injectable } from '@nestjs/common'
import { DB, type DbToken } from '../../core/tokens.js'
import type { Db } from '../../db/client.js'
import { UnauthorizedError } from '../../errors.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import type { AuthenticatedUser } from '../auth/contract.js'

/**
 * Per-request worktime context (ADR-0025): resolves the authenticated caller to
 * their workspace (and, for shift ownership, their user id) over the `DB` token.
 * Every route scopes to the id this resolves — never one from the client — so
 * attendance state is workspace-isolated by construction (ADR-0015).
 */
@Injectable()
export class WorktimeContext {
  constructor(@Inject(DB) private readonly db: DbToken) {}

  private requireDb(): Db {
    if (!this.db) throw new UnauthorizedError('Authentication is not configured')
    return this.db
  }

  /** The caller's workspace id and the live DB handle. */
  async workspaceOf(user: AuthenticatedUser): Promise<{ db: Db; workspaceId: string }> {
    const db = this.requireDb()
    return { db, workspaceId: await resolveWorkspaceId(db, user.id, user.name) }
  }

  /** The caller's workspace id, user id, and DB handle (for shift ownership). */
  async contextOf(
    user: AuthenticatedUser,
  ): Promise<{ db: Db; workspaceId: string; userId: string }> {
    const { db, workspaceId } = await this.workspaceOf(user)
    return { db, workspaceId, userId: user.id }
  }
}
