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
import type { RecurrenceEnd } from '@mydevtime/domain'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import * as svc from './service.js'
import { RecurrenceContext } from './recurrence.context.js'
import {
  CreateSeriesDto,
  IdParamDto,
  OccurrencesQueryDto,
  TruncateSeriesDto,
} from './recurrence.dto.js'

/**
 * The `recurrence` surface (REQ-060, design v17 §F4): recurring-entry **series** and their
 * projected occurrences. Every route runs behind `AuthGuard` and scopes to the caller's
 * workspace via `RecurrenceContext`, so series are workspace-isolated by construction. All
 * occurrence math is the deterministic core's (ADR-0005).
 */
@ApiTags('recurrence')
@Controller('api/recurrence')
@UseGuards(AuthGuard)
export class RecurrenceController {
  constructor(private readonly ctx: RecurrenceContext) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.listSeries(db, workspaceId)
  }

  @Get('occurrences')
  async occurrences(@CurrentUser() user: AuthenticatedUser, @Query() query: OccurrencesQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.listOccurrences(db, workspaceId, query.from, query.to)
  }

  @Post()
  @HttpCode(201)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateSeriesDto) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    // The DTO's cross-field refine guarantees the matching bound is present; the null
    // checks narrow it without an assertion.
    let end: RecurrenceEnd = { kind: 'never' }
    if (body.endKind === 'until' && body.untilDate != null) {
      end = { kind: 'until', date: body.untilDate }
    } else if (body.endKind === 'count' && body.count != null) {
      end = { kind: 'count', count: body.count }
    }
    return svc.createSeries(db, workspaceId, userId, {
      kind: body.kind,
      title: body.title,
      anchorDate: body.anchorDate,
      startMin: body.startMin,
      lenMin: body.lenMin,
      freq: body.freq,
      end,
      projectId: body.projectId,
      priority: body.priority,
      note: body.note,
    })
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    await svc.deleteSeries(db, workspaceId, params.id)
  }

  @Post(':id/truncate')
  async truncate(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: TruncateSeriesDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.truncateSeries(db, workspaceId, params.id, body.at)
  }
}
