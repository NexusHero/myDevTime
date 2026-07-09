import { Inject, Injectable } from '@nestjs/common'
import { DB, type DbToken } from '../../core/tokens.js'
import type { Db } from '../../db/client.js'
import { UnauthorizedError } from '../../errors.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import type { AuthenticatedUser } from '../auth/contract.js'

/**
 * Per-request billing context (ADR-0025): resolves the authenticated caller to
 * their workspace over the `DB` token. Every billing route scopes to the id this
 * resolves — never one supplied by the client — so money state is workspace
 * isolated by construction (ADR-0015).
 */
@Injectable()
export class BillingContext {
  constructor(@Inject(DB) private readonly db: DbToken) {}

  /**
   * The live DB handle, or 401 when persistence is not configured. The Stripe
   * webhook uses this directly — it is authenticated by its signature, not a
   * session, and derives the workspace from the Stripe customer mapping.
   */
  database(): Db {
    if (!this.db) throw new UnauthorizedError('Authentication is not configured')
    return this.db
  }

  /** The caller's workspace id and the live DB handle. */
  async workspaceOf(user: AuthenticatedUser): Promise<{ db: Db; workspaceId: string }> {
    const db = this.database()
    return { db, workspaceId: await resolveWorkspaceId(db, user.id, user.name) }
  }
}
