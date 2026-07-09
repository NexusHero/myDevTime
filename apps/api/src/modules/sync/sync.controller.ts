import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { DB, type DbToken } from '../../core/tokens.js'
import type { Db } from '../../db/client.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import { UnauthorizedError } from '../../errors.js'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import { pullChanges, pushChanges } from './service.js'
import { PullQueryDto, PushBodyDto, type PullResponse, type PushResponse } from './sync.dto.js'

/**
 * The `sync` module (ADR-0019/0025): cross-device delta sync (REQ-006). Both
 * routes run behind `AuthGuard` and resolve the caller's workspace from their
 * identity, so a device can only ever sync its own workspace (isolation by
 * construction). The deterministic conflict engine stays in `packages/domain`.
 */
@ApiTags('sync')
@Controller('api/sync')
export class SyncController {
  constructor(@Inject(DB) private readonly db: DbToken) {}

  @Get('status')
  status(): { module: 'sync'; status: 'ok' } {
    return { module: 'sync', status: 'ok' }
  }

  @Post('push')
  @UseGuards(AuthGuard)
  async push(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PushBodyDto,
  ): Promise<PushResponse> {
    const db = this.requireDb()
    const workspaceId = await resolveWorkspaceId(db, user.id, user.name)
    return (await pushChanges(db, workspaceId, body.changes)) as PushResponse
  }

  @Get('pull')
  @UseGuards(AuthGuard)
  async pull(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PullQueryDto,
  ): Promise<PullResponse> {
    const db = this.requireDb()
    const workspaceId = await resolveWorkspaceId(db, user.id, user.name)
    return (await pullChanges(db, workspaceId, query.since)) as PullResponse
  }

  private requireDb(): Db {
    if (!this.db) throw new UnauthorizedError('Authentication is not configured')
    return this.db
  }
}
