import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import * as svc from './service.js'
import { PrivacyContext } from './privacy.context.js'
import { EraseAccountDto, PurgeRetentionDto } from './privacy.dto.js'

/**
 * GDPR API (REQ-020): data portability (a complete JSON export of the caller's workspace),
 * the right to erasure (account + workspace deletion behind an explicit confirmation literal),
 * and storage limitation (hard-purge of expired soft-deleted tombstones). Every route resolves
 * the workspace from the authenticated caller (`AuthGuard`), never from the client, so a user
 * can only ever export or erase their OWN data (ADR-0015).
 */
@ApiTags('privacy')
@Controller('api/privacy')
@UseGuards(AuthGuard)
export class PrivacyController {
  constructor(private readonly ctx: PrivacyContext) {}

  @Get('export')
  async exportData(@CurrentUser() user: AuthenticatedUser): Promise<svc.WorkspaceExport> {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.exportWorkspaceData(db, workspaceId, user.id)
  }

  @Delete('account')
  @HttpCode(204)
  async eraseAccount(
    @CurrentUser() user: AuthenticatedUser,
    // Validated for the `confirm: 'DELETE'` literal — a request without it never gets here.
    @Body() _body: EraseAccountDto,
  ): Promise<void> {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    await svc.eraseAccount(db, workspaceId, user.id)
  }

  @Post('retention/purge')
  async purgeRetention(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PurgeRetentionDto,
  ): Promise<{ purged: svc.PurgeResult }> {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return { purged: await svc.purgeSoftDeleted(db, workspaceId, body.olderThanDays) }
  }
}
