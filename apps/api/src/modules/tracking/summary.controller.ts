import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import { summarize } from './summary-service.js'
import { TrackingContext } from './tracking.context.js'
import { SummaryQueryDto } from './tracking.dto.js'

/**
 * Reporting summary route (REQ-005): the workspace's tracked time over a window,
 * aggregated per day and project by the deterministic core. Behind `AuthGuard`
 * and scoped to the caller's workspace via `TrackingContext` (ADR-0015/0025).
 */
@ApiTags('tracking')
@Controller('api/tracking/summary')
@UseGuards(AuthGuard)
export class SummaryController {
  constructor(private readonly ctx: TrackingContext) {}

  @Get()
  async summary(@CurrentUser() user: AuthenticatedUser, @Query() query: SummaryQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return summarize(db, workspaceId, { from: query.from, to: query.to, tz: query.tz })
  }
}
