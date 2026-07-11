import { Inject, Injectable } from '@nestjs/common'
import { DB, type DbToken } from '../../core/tokens.js'
import type { Db } from '../../db/client.js'
import { UnauthorizedError } from '../../errors.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import type { AuthenticatedUser } from '../auth/contract.js'

/**
 * Per-request `ai` context (ADR-0025): resolves the authenticated caller to their
 * workspace over the `DB` token, so credit-priced AI routes (e.g. the assistant)
 * scope billing and reads to the caller's own workspace — never a client-supplied id.
 */
@Injectable()
export class AiContext {
  constructor(@Inject(DB) private readonly db: DbToken) {}

  async workspaceOf(user: AuthenticatedUser): Promise<{ db: Db; workspaceId: string }> {
    if (!this.db) throw new UnauthorizedError('Authentication is not configured')
    return { db: this.db, workspaceId: await resolveWorkspaceId(this.db, user.id, user.name) }
  }
}
