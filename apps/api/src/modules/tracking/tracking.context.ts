import { Inject, Injectable } from '@nestjs/common'
import { DB, type DbToken } from '../../core/tokens.js'
import type { Db } from '../../db/client.js'
import { UnauthorizedError } from '../../errors.js'
import type { AuthenticatedUser } from '../auth/contract.js'
import { resolveWorkspaceId } from './workspace.js'

/**
 * Per-request tracking context (ADR-0025): resolves the authenticated caller to
 * their workspace (provisioning one on first use) and, where an entry needs an
 * owner, their user id. Isolation holds by construction — a route can only act
 * on the workspace this resolves, never one supplied by the client. Injectable so
 * both the catalog and entry controllers share one seam over the `DB` token.
 */
@Injectable()
export class TrackingContext {
  constructor(@Inject(DB) private readonly db: DbToken) {}

  /** The live DB handle, or 401 when persistence is not configured. */
  private requireDb(): Db {
    if (!this.db) throw new UnauthorizedError('Authentication is not configured')
    return this.db
  }

  /** The caller's workspace id and the live DB handle. */
  async workspaceOf(user: AuthenticatedUser): Promise<{ db: Db; workspaceId: string }> {
    const db = this.requireDb()
    return { db, workspaceId: await resolveWorkspaceId(db, user.id, user.name) }
  }

  /** The caller's workspace id, user id, and DB handle (for entry ownership). */
  async contextOf(
    user: AuthenticatedUser,
  ): Promise<{ db: Db; workspaceId: string; userId: string }> {
    const { db, workspaceId } = await this.workspaceOf(user)
    return { db, workspaceId, userId: user.id }
  }
}
