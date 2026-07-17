import { Body, Controller, Get, HttpCode, Post, Put, Query, Res, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import * as svc from './service.js'
import { WorktimeContext } from './worktime.context.js'
import { loadWorktimeReport } from './report/source.js'
import { loadMonthlyStatement } from './report/statement-source.js'
import { worktimeReportToPdf } from './report/pdf.js'
import { monthlyStatementToPdf } from './report/statement-pdf.js'
import { worktimeReportToXlsx } from './report/xlsx.js'
import {
  ClockInDto,
  ClockOutDto,
  CoverageQueryDto,
  CreateShiftDto,
  ReportQueryDto,
  SetScheduleDto,
  ShiftsQueryDto,
  StatementQueryDto,
  WorktimeSummaryQueryDto,
} from './worktime.dto.js'

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

  // ── Signable work-time report (PDF / XLSX) ───────────────────────────────
  @Get('report')
  async report(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const { report, meta } = await loadWorktimeReport(db, workspaceId, {
      year: query.year,
      month: query.month,
      tz: query.tz,
    })
    const base = `worktime-${meta.monthLabel}`.replace(/[^\w.-]+/g, '_')
    if (query.format === 'xlsx') {
      const buffer = await worktimeReportToXlsx(report, meta)
      await reply
        .header('content-disposition', `attachment; filename="${base}.xlsx"`)
        .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .send(buffer)
      return
    }
    const buffer = await worktimeReportToPdf(report, meta, query.locale)
    await reply
      .header('content-disposition', `attachment; filename="${base}.pdf"`)
      .type('application/pdf')
      .send(buffer)
  }

  // ── Monthly work-time statement — "real punch clock" (PDF, one month/page) ──
  @Get('statement')
  async statement(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StatementQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const { statement, meta } = await loadMonthlyStatement(db, workspaceId, {
      year: query.year,
      month: query.month,
      tz: query.tz,
    })
    const base = `statement-${meta.monthLabel}`.replace(/[^\w.-]+/g, '_')
    const buffer = await monthlyStatementToPdf(statement, meta, query.locale)
    await reply
      .header('content-disposition', `attachment; filename="${base}.pdf"`)
      .type('application/pdf')
      .send(buffer)
  }

  @Get('shifts')
  async listShifts(@CurrentUser() user: AuthenticatedUser, @Query() query: ShiftsQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.listShifts(db, workspaceId, { from: query.from, to: query.to })
  }

  @Get('coverage')
  async coverage(@CurrentUser() user: AuthenticatedUser, @Query() query: CoverageQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.worktimeCoverage(db, workspaceId, { from: query.from, to: query.to })
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

  // ── Punch clock ──────────────────────────────────────────────────────────
  @Get('running')
  async running(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.getRunningShift(db, workspaceId)
  }

  @Post('clock-in')
  @HttpCode(201)
  async clockIn(@CurrentUser() user: AuthenticatedUser, @Body() body: ClockInDto) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return svc.clockIn(db, workspaceId, userId, {
      startedAt: body.startedAt,
      source: body.source,
    })
  }

  @Post('clock-out')
  async clockOut(@CurrentUser() user: AuthenticatedUser, @Body() body: ClockOutDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.clockOut(db, workspaceId, { endedAt: body.endedAt, breakMs: body.breakMs })
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
