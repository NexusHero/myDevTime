import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import * as svc from './service.js'
import { AutomationContext } from './automation.context.js'
import { CreateRuleDto, DryRunRulesDto, UpdateRuleDto } from './automation.dto.js'

/**
 * Categorization rules API (REQ-011, ADR-0005): CRUD over the workspace's ordered `matcher → action`
 * rules, plus a **dry-run** that previews what the deterministic engine would propose over a batch
 * of subjects — without writing anything. Every route resolves the workspace from the authenticated
 * caller (`AuthGuard`), never from the client, so rules stay workspace-isolated (ADR-0015).
 */
@ApiTags('automation')
@Controller('api/automation')
@UseGuards(AuthGuard)
export class RulesController {
  constructor(private readonly ctx: AutomationContext) {}

  @Get('rules')
  async list(@CurrentUser() user: AuthenticatedUser): Promise<svc.RuleRow[]> {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.listRules(db, workspaceId)
  }

  @Post('rules')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateRuleDto,
  ): Promise<svc.RuleRow> {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.createRule(db, workspaceId, body)
  }

  @Get('rules/:id')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<svc.RuleRow> {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.getRule(db, workspaceId, id)
  }

  @Patch('rules/:id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateRuleDto,
  ): Promise<svc.RuleRow> {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.updateRule(db, workspaceId, id, body)
  }

  @Delete('rules/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    await svc.deleteRule(db, workspaceId, id)
  }

  @Post('rules/dry-run')
  async dryRun(@CurrentUser() user: AuthenticatedUser, @Body() body: DryRunRulesDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.dryRunRules(db, workspaceId, body.subjects)
  }
}
