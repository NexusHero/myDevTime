import { Inject, Injectable } from '@nestjs/common'
import { DB, type DbToken } from '../../core/tokens.js'
import type { Db } from '../../db/client.js'
import { UnauthorizedError } from '../../errors.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import type { AuthenticatedUser } from '../auth/contract.js'

/**
 * Per-request connectors context (ADR-0025/0032): resolves the caller to their
 * workspace + user over the `DB` token, so every token/consent row scopes to ids
 * this resolves — never client-supplied — keeping connector secrets workspace- and
 * user-isolated by construction.
 */
@Injectable()
export class ConnectorsContext {
  constructor(@Inject(DB) private readonly db: DbToken) {}

  async contextOf(
    user: AuthenticatedUser,
  ): Promise<{ db: Db; workspaceId: string; userId: string }> {
    if (!this.db) throw new UnauthorizedError('Authentication is not configured')
    const workspaceId = await resolveWorkspaceId(this.db, user.id, user.name)
    return { db: this.db, workspaceId, userId: user.id }
  }
}
