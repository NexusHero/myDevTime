import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import * as svc from './service.js'
import { PlannerContext } from './planner.context.js'
import { GeneratePlanDto, IdParamDto, PlanDateQueryDto, PlanStatusDto } from './planner.dto.js'

/**
 * The Co-Planner surface (REQ-031, ADR-0011): generate a proposed day plan from
 * the deterministic core, read the latest proposal for a day, and record the
 * user's accept / dismiss response. Every route runs behind `AuthGuard` and scopes
 * to the caller's workspace via `PlannerContext`. The planning algorithm is the
 * core's (ADR-0005); no LLM places time here.
 */
@ApiTags('planner')
@Controller('api/planner')
@UseGuards(AuthGuard)
export class PlannerController {
  constructor(private readonly ctx: PlannerContext) {}

  @Get('plans')
  async latest(@CurrentUser() user: AuthenticatedUser, @Query() query: PlanDateQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.getLatestPlan(db, workspaceId, query.date)
  }

  @Post('plans')
  @HttpCode(201)
  async generate(@CurrentUser() user: AuthenticatedUser, @Body() body: GeneratePlanDto) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return svc.generatePlan(db, workspaceId, userId, {
      date: body.date,
      plan: {
        dayStartMin: body.dayStartMin,
        dayEndMin: body.dayEndMin,
        anchors: body.anchors,
        backlog: body.backlog,
        ...(body.breakAfterMin === undefined ? {} : { breakAfterMin: body.breakAfterMin }),
        ...(body.breakLenMin === undefined ? {} : { breakLenMin: body.breakLenMin }),
        ...(body.minBlockMin === undefined ? {} : { minBlockMin: body.minBlockMin }),
      },
    })
  }

  @Post('plans/:id/status')
  async setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: PlanStatusDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.setPlanStatus(db, workspaceId, params.id, body.status)
  }
}
