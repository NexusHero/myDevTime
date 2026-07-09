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
import * as svc from './service.js'
import { TrackingContext } from './tracking.context.js'
import {
  CreateClientDto,
  CreateProjectDto,
  CreateTagDto,
  CreateTaskDto,
  IdParamDto,
  ListQueryDto,
  UpdateClientDto,
  UpdateProjectDto,
  UpdateTagDto,
  UpdateTaskDto,
} from './tracking.dto.js'

/**
 * Workspace catalog CRUD (REQ-001): clients → projects → tasks, plus tags. Every
 * route runs behind `AuthGuard` and scopes to the caller's workspace via
 * `TrackingContext`, so isolation holds by construction (ADR-0015/0025).
 */
@ApiTags('tracking')
@Controller('api/tracking')
@UseGuards(AuthGuard)
export class CatalogController {
  constructor(private readonly ctx: TrackingContext) {}

  // ── Clients ──────────────────────────────────────────────────────────────
  @Post('clients')
  @HttpCode(201)
  async createClient(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateClientDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.createClient(db, workspaceId, body)
  }

  @Get('clients')
  async listClients(@CurrentUser() user: AuthenticatedUser, @Query() query: ListQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.listClients(db, workspaceId, query.includeArchived)
  }

  @Get('clients/:id')
  async getClient(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.getClient(db, workspaceId, params.id)
  }

  @Patch('clients/:id')
  async updateClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateClientDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.updateClient(db, workspaceId, params.id, body)
  }

  @Delete('clients/:id')
  @HttpCode(204)
  async deleteClient(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    await svc.deleteClient(db, workspaceId, params.id)
  }

  // ── Projects ─────────────────────────────────────────────────────────────
  @Post('projects')
  @HttpCode(201)
  async createProject(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateProjectDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.createProject(db, workspaceId, body)
  }

  @Get('projects')
  async listProjects(@CurrentUser() user: AuthenticatedUser, @Query() query: ListQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.listProjects(db, workspaceId, query.includeArchived)
  }

  @Get('projects/:id')
  async getProject(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.getProject(db, workspaceId, params.id)
  }

  @Patch('projects/:id')
  async updateProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateProjectDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.updateProject(db, workspaceId, params.id, body)
  }

  @Delete('projects/:id')
  @HttpCode(204)
  async deleteProject(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    await svc.deleteProject(db, workspaceId, params.id)
  }

  // ── Tasks ────────────────────────────────────────────────────────────────
  @Post('tasks')
  @HttpCode(201)
  async createTask(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateTaskDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.createTask(db, workspaceId, body)
  }

  @Get('tasks')
  async listTasks(@CurrentUser() user: AuthenticatedUser, @Query() query: ListQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.listTasks(db, workspaceId, query.includeArchived)
  }

  @Get('tasks/:id')
  async getTask(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.getTask(db, workspaceId, params.id)
  }

  @Patch('tasks/:id')
  async updateTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateTaskDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.updateTask(db, workspaceId, params.id, body)
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  async deleteTask(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    await svc.deleteTask(db, workspaceId, params.id)
  }

  // ── Tags ─────────────────────────────────────────────────────────────────
  @Post('tags')
  @HttpCode(201)
  async createTag(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateTagDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.createTag(db, workspaceId, body)
  }

  @Get('tags')
  async listTags(@CurrentUser() user: AuthenticatedUser, @Query() query: ListQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.listTags(db, workspaceId, query.includeArchived)
  }

  @Patch('tags/:id')
  async updateTag(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateTagDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.updateTag(db, workspaceId, params.id, body)
  }

  @Delete('tags/:id')
  @HttpCode(204)
  async deleteTag(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    await svc.deleteTag(db, workspaceId, params.id)
  }
}
