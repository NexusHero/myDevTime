import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import * as svc from './service.js'
import { AbsencesContext } from './absences.context.js'
import {
  AbsenceRangeQueryDto,
  BalanceQueryDto,
  CreateAbsenceDto,
  IdParamDto,
  SetPolicyDto,
} from './absences.dto.js'

/**
 * The `absences` surface (REQ-029, ADR-0010): leave ranges, the per-workspace
 * vacation policy, and the allowance balance. Every route runs behind `AuthGuard`
 * and scopes to the caller's workspace via `AbsencesContext`, so state is
 * workspace-isolated by construction. All allowance math is the deterministic
 * core's (ADR-0005).
 */
@ApiTags('absences')
@Controller('api/absences')
@UseGuards(AuthGuard)
export class AbsencesController {
  constructor(private readonly ctx: AbsencesContext) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: AbsenceRangeQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.listAbsences(db, workspaceId, { from: query.from, to: query.to })
  }

  @Post()
  @HttpCode(201)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAbsenceDto) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return svc.createAbsence(db, workspaceId, userId, {
      kind: body.kind,
      startDate: body.startDate,
      endDate: body.endDate,
      halfDay: body.halfDay,
      note: body.note,
    })
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    await svc.deleteAbsence(db, workspaceId, params.id)
  }

  @Get('balance')
  async balance(@CurrentUser() user: AuthenticatedUser, @Query() query: BalanceQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.balanceForYear(db, workspaceId, query.year)
  }

  @Get('policy')
  async getPolicy(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.getPolicy(db, workspaceId)
  }

  @Put('policy')
  async setPolicy(@CurrentUser() user: AuthenticatedUser, @Body() body: SetPolicyDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.setPolicy(db, workspaceId, {
      annualAllowanceDays: body.annualAllowanceDays,
      carryOverDays: body.carryOverDays,
    })
  }
}
