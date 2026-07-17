import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import * as svc from './service.js'
import { SharingContext } from './sharing.context.js'
import { CreateShareDto, FreeBusyQueryDto, IdParamDto, TokenParamDto } from './sharing.dto.js'

/**
 * The `sharing` surface (REQ-064, design v17 §F6): partner-light Free/Busy links. The management
 * routes (mint / list / revoke) run behind `AuthGuard` and scope to the owner's workspace via
 * `SharingContext` — isolated by construction (ADR-0015). The **public** Free/Busy route carries
 * no guard on purpose: partner-light is "one link, free to view", so an invitee reads it with the
 * link secret alone and no account. It returns only the deterministic Free/Busy projection
 * (ADR-0005) — never a title, project, or note.
 */
@ApiTags('sharing')
@Controller('api/sharing')
export class SharingController {
  constructor(private readonly ctx: SharingContext) {}

  @Post()
  @HttpCode(201)
  @UseGuards(AuthGuard)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateShareDto) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return svc.createShare(db, workspaceId, userId, body.label ?? null)
  }

  @Get()
  @UseGuards(AuthGuard)
  async list(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId } = await this.ctx.contextOf(user)
    return svc.listShares(db, workspaceId)
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async revoke(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.contextOf(user)
    await svc.revokeShare(db, workspaceId, params.id, Date.now())
  }

  /**
   * Public: the Free/Busy an invitee sees. No `AuthGuard` — the link token is the credential.
   * Only busy spans + free gaps cross the boundary; the endpoint never reads a detail column.
   */
  @Get(':token/freebusy')
  async freeBusy(@Param() params: TokenParamDto, @Query() query: FreeBusyQueryDto) {
    const db = this.ctx.requireDb()
    return svc.freeBusyForShare(db, params.token, query.from, query.to)
  }
}
