import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import * as entries from './entries-service.js'
import { TrackingContext } from './tracking.context.js'
import {
  CreateEntryDto,
  IdParamDto,
  ListEntriesQueryDto,
  SplitEntryDto,
  StartTimerDto,
  StopTimerDto,
  UpdateEntryDto,
} from './tracking.dto.js'

/**
 * Time-entry routes (REQ-004): the live timer (start/stop/running) and manual
 * entries (create/list/get/edit/split/delete). Every route runs behind
 * `AuthGuard` and scopes to the caller's workspace via `TrackingContext`
 * (ADR-0015/0025).
 */
@ApiTags('tracking')
@Controller('api/tracking/entries')
@UseGuards(AuthGuard)
export class EntriesController {
  constructor(private readonly ctx: TrackingContext) {}

  @Post('timer/start')
  @HttpCode(201)
  async startTimer(@CurrentUser() user: AuthenticatedUser, @Body() body: StartTimerDto) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return entries.startTimer(db, workspaceId, userId, body)
  }

  @Post('timer/stop')
  async stopTimer(@CurrentUser() user: AuthenticatedUser, @Body() body: StopTimerDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return entries.stopTimer(db, workspaceId, body.endedAt ?? new Date())
  }

  @Get('running')
  async getRunning(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return entries.getRunning(db, workspaceId)
  }

  @Post()
  @HttpCode(201)
  async createManualEntry(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateEntryDto) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return entries.createManualEntry(db, workspaceId, userId, body)
  }

  @Get()
  async listEntries(@CurrentUser() user: AuthenticatedUser, @Query() query: ListEntriesQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return entries.listEntries(db, workspaceId, query)
  }

  @Get(':id')
  async getEntry(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return entries.getEntry(db, workspaceId, params.id)
  }

  @Patch(':id')
  async updateEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateEntryDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return entries.updateEntry(db, workspaceId, params.id, body)
  }

  @Post(':id/split')
  async splitEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: SplitEntryDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return entries.splitEntry(db, workspaceId, params.id, body.at)
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteEntry(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    await entries.deleteEntry(db, workspaceId, params.id)
  }
}
