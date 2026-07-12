import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { JWK } from 'jose'
import { CONFIG, DB, type ConfigToken, type DbToken } from '../../core/tokens.js'
import type { Db } from '../../db/client.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import { NotFoundError, UnauthorizedError } from '../../errors.js'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import { pullChanges, pushChanges, uploadCrud } from './service.js'
import { DEFAULT_TTL_SECONDS, mintPowerSyncToken, powerSyncJwks } from './powersync-auth.js'
import { POWERSYNC_KEYS, type PowerSyncKeysToken } from './sync.tokens.js'
import {
  PullQueryDto,
  PushBodyDto,
  UploadBodyDto,
  type PullResponse,
  type PushResponse,
  type UploadResponse,
} from './sync.dto.js'

/**
 * The `sync` module (ADR-0019/0025): cross-device delta sync (REQ-006). Both
 * routes run behind `AuthGuard` and resolve the caller's workspace from their
 * identity, so a device can only ever sync its own workspace (isolation by
 * construction). The deterministic conflict engine stays in `packages/domain`.
 */
@ApiTags('sync')
@Controller('api/sync')
export class SyncController {
  constructor(
    @Inject(DB) private readonly db: DbToken,
    @Inject(CONFIG) private readonly config: ConfigToken,
    @Inject(POWERSYNC_KEYS) private readonly powerSyncKeys: PowerSyncKeysToken,
  ) {}

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

  /** PowerSync `uploadData` target (ADR-0043): apply the client's CRUD write queue. */
  @Post('upload')
  @UseGuards(AuthGuard)
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UploadBodyDto,
  ): Promise<UploadResponse> {
    const db = this.requireDb()
    const workspaceId = await resolveWorkspaceId(db, user.id, user.name)
    return (await uploadCrud(db, workspaceId, body.writes)) as UploadResponse
  }

  /** JWKS for the PowerSync service to validate device tokens (ADR-0043). Public. */
  @Get('keys')
  powerSyncKeySet(): { keys: readonly JWK[] } {
    if (!this.powerSyncKeys) throw new NotFoundError('PowerSync auth is not configured')
    return powerSyncJwks(this.powerSyncKeys)
  }

  /** Mint a short-lived PowerSync device token for the caller's workspace (ADR-0043). */
  @Get('token')
  @UseGuards(AuthGuard)
  async powerSyncToken(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ token: string; expiresIn: number }> {
    if (!this.powerSyncKeys) throw new NotFoundError('PowerSync auth is not configured')
    const db = this.requireDb()
    const workspaceId = await resolveWorkspaceId(db, user.id, user.name)
    const issuer = this.config.POWERSYNC_JWT_ISSUER ?? this.config.AUTH_BASE_URL ?? 'mydevtime'
    const token = await mintPowerSyncToken(this.powerSyncKeys, {
      userId: user.id,
      workspaceId,
      issuer,
    })
    return { token, expiresIn: DEFAULT_TTL_SECONDS }
  }

  private requireDb(): Db {
    if (!this.db) throw new UnauthorizedError('Authentication is not configured')
    return this.db
  }
}
