import { Body, Controller, Get, HttpCode, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import * as svc from './service.js'
import { WorktimeContext } from './worktime.context.js'
import { CreateShiftDto, SetScheduleDto, WorktimeSummaryQueryDto } from './worktime.dto.js'

/**
 * The `worktime` attendance surface (REQ-028, ADR-0010): record shifts, set the
 * effective-dated target-hour schedule, and read the overtime balance for a
 * window. Every route runs behind `AuthGuard` and scopes to the caller's
 * workspace via `WorktimeContext`, so state is workspace-isolated by construction.
 * All arithmetic is the deterministic core's (ADR-0005).
 */
@ApiTags('worktime')
@Controller('api/worktime')
@UseGuards(AuthGuard)
export class WorktimeController {
  constructor(private readonly ctx: WorktimeContext) {}

  @Get('summary')
  async summary(@CurrentUser() user: AuthenticatedUser, @Query() query: WorktimeSummaryQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.worktimeSummary(db, workspaceId, {
      from: query.from,
      to: query.to,
      tz: query.tz,
      asOf: query.asOf,
    })
  }

  @Post('shifts')
  @HttpCode(201)
  async createShift(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateShiftDto) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return svc.createShift(db, workspaceId, userId, {
      startedAt: body.startedAt,
      endedAt: body.endedAt,
      breakMs: body.breakMs,
      source: body.source,
    })
  }

  @Put('schedule')
  async setSchedule(@CurrentUser() user: AuthenticatedUser, @Body() body: SetScheduleDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.setSchedule(db, workspaceId, {
      effectiveFrom: body.effectiveFrom,
      weeklyTargetMs: body.weeklyTargetMs,
    })
  }
}
