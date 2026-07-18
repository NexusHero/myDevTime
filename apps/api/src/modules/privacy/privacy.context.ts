import { Inject, Injectable } from '@nestjs/common'
import { DB, type DbToken } from '../../core/tokens.js'
import type { Db } from '../../db/client.js'
import { UnauthorizedError } from '../../errors.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import type { AuthenticatedUser } from '../auth/contract.js'

/**
 * Per-request privacy context (ADR-0025): resolves the authenticated caller to their workspace
 * over the `DB` token. Every privacy route (export, erasure, retention purge — REQ-020) scopes
 * to the id this resolves — never one from the client — so a caller can only ever export or
 * erase their OWN workspace (ADR-0015 isolation by construction).
 */
@Injectable()
export class PrivacyContext {
  constructor(@Inject(DB) private readonly db: DbToken) {}

  private requireDb(): Db {
    if (!this.db) throw new UnauthorizedError('Authentication is not configured')
    return this.db
  }

  async workspaceOf(user: AuthenticatedUser): Promise<{ db: Db; workspaceId: string }> {
    const db = this.requireDb()
    return { db, workspaceId: await resolveWorkspaceId(db, user.id, user.name) }
  }
}
