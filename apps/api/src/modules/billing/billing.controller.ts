import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import type { RoundingIncrementMinutes } from '@mydevtime/domain'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import * as svc from './service.js'
import * as invoicing from './invoice-service.js'
import * as entitlements from './entitlements-service.js'
import * as credits from './credits-service.js'
import { loadTimesheet } from './export/timesheet-source.js'
import { timesheetToCsv } from './export/csv.js'
import { timesheetToXlsx } from './export/xlsx.js'
import { timesheetToPdf } from './export/pdf.js'
import { BillingContext } from './billing.context.js'
import {
  AsOfQueryDto,
  BillingSummaryQueryDto,
  CreateBudgetDto,
  CreateRateDto,
  DebitDto,
  ExportQueryDto,
  GrantDto,
  IdParamDto,
  InvoicePreviewQueryDto,
  IssueInvoiceDto,
  LedgerQueryDto,
  RecordEntitlementEventDto,
  UsageQueryDto,
} from './billing.dto.js'

/**
 * The `billing` money + monetization surface (ADR-0003/0006/0008/0025).
 * REQ-005 — effective-dated rates, budgets, project cost, threshold alerts;
 * REQ-009 — timesheet export (CSV/XLSX/PDF); REQ-016 — the entitlement service
 * (plan derived from an append-only event log; feature gates ask here, never a
 * payment SDK). Every route runs behind `AuthGuard` and resolves the caller's
 * workspace, so state is workspace-isolated by construction.
 */
@ApiTags('billing')
@Controller('api/billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly ctx: BillingContext) {}

  // ── Rates ──────────────────────────────────────────────────────────────
  @Post('rates')
  @HttpCode(201)
  async createRate(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRateDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.createRate(db, workspaceId, body)
  }

  @Get('rates')
  async listRates(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.listRates(db, workspaceId)
  }

  @Delete('rates/:id')
  @HttpCode(204)
  async deleteRate(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    await svc.deleteRate(db, workspaceId, params.id)
  }

  // ── Budgets ────────────────────────────────────────────────────────────
  @Post('budgets')
  @HttpCode(201)
  async createBudget(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateBudgetDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.createBudget(db, workspaceId, body)
  }

  @Get('budgets')
  async listBudgets(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.listBudgets(db, workspaceId)
  }

  @Get('budgets/:id')
  async getBudget(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.getBudget(db, workspaceId, params.id)
  }

  @Delete('budgets/:id')
  @HttpCode(204)
  async deleteBudget(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    await svc.deleteBudget(db, workspaceId, params.id)
  }

  @Get('budgets/:id/status')
  async budgetStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Query() query: AsOfQueryDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.budgetStatusFor(db, workspaceId, params.id, query.asOf ?? new Date())
  }

  @Post('budgets/:id/evaluate')
  async evaluateBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Query() query: AsOfQueryDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.evaluateBudget(db, workspaceId, params.id, query.asOf ?? new Date())
  }

  // ── Cost ───────────────────────────────────────────────────────────────
  @Get('projects/:id/cost')
  async projectCost(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Query() query: AsOfQueryDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.projectCost(db, workspaceId, params.id, query.asOf ?? new Date())
  }

  @Get('summary')
  async summary(@CurrentUser() user: AuthenticatedUser, @Query() query: BillingSummaryQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.billingSummary(db, workspaceId, {
      from: query.from,
      to: query.to,
      asOf: query.asOf ?? new Date(),
    })
  }

  // ── Invoicing / "Abrechnung" (design v6, REQ-005/009) ────────────────────
  @Get('invoices')
  async listInvoices(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return invoicing.listInvoices(db, workspaceId)
  }

  @Get('invoices/preview')
  async previewInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InvoicePreviewQueryDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return invoicing.previewInvoice(db, workspaceId, {
      clientId: query.clientId,
      from: query.from,
      to: query.to,
    })
  }

  @Post('invoices')
  @HttpCode(201)
  async issueInvoice(@CurrentUser() user: AuthenticatedUser, @Body() body: IssueInvoiceDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return invoicing.issueInvoice(db, workspaceId, {
      clientId: body.clientId,
      from: body.from,
      to: body.to,
      entryIds: body.entryIds,
    })
  }

  @Delete('invoices/:id')
  @HttpCode(204)
  async voidInvoice(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    await invoicing.voidInvoice(db, workspaceId, params.id)
  }

  // ── AI-credit ledger (REQ-027, ADR-0008) ─────────────────────────────────
  @Get('credits')
  async creditBalance(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return { balance: await credits.balanceFor(db, workspaceId) }
  }

  @Get('credits/ledger')
  async creditLedger(@CurrentUser() user: AuthenticatedUser, @Query() query: LedgerQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return credits.listLedger(db, workspaceId, query.limit)
  }

  @Get('credits/usage')
  async creditUsage(@CurrentUser() user: AuthenticatedUser, @Query() query: UsageQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return credits.usageFor(db, workspaceId, { from: query.from, to: query.to })
  }

  @Post('credits/debit')
  @HttpCode(201)
  async creditDebit(@CurrentUser() user: AuthenticatedUser, @Body() body: DebitDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return credits.debit(db, workspaceId, {
      amount: body.amount,
      category: body.category,
      reason: body.reason,
      operationId: body.operationId,
    })
  }

  @Post('credits/grant')
  @HttpCode(201)
  async creditGrant(@CurrentUser() user: AuthenticatedUser, @Body() body: GrantDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return credits.grant(db, workspaceId, {
      amount: body.amount,
      kind: body.kind,
      category: body.category,
      reason: body.reason,
      operationId: body.operationId,
    })
  }

  // ── Timesheet export (CSV / XLSX / PDF) ──────────────────────────────────
  @Get('projects/:id/timesheet')
  async exportTimesheet(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Query() query: ExportQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const { timesheet, meta } = await loadTimesheet(db, workspaceId, {
      projectId: params.id,
      from: query.from,
      to: query.to,
      groupBy: query.groupBy,
      rounding: {
        mode: query.roundingMode,
        incrementMinutes: query.roundingIncrement as RoundingIncrementMinutes,
      },
      billableOnly: query.billableOnly,
      asOf: query.asOf ?? new Date(),
    })
    const base = `timesheet-${meta.projectName}`.replace(/[^\w.-]+/g, '_')
    if (query.format === 'xlsx') {
      const buffer = await timesheetToXlsx(timesheet, meta)
      await reply
        .header('content-disposition', `attachment; filename="${base}.xlsx"`)
        .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .send(buffer)
      return
    }
    if (query.format === 'pdf') {
      const buffer = await timesheetToPdf(timesheet, meta, query.locale)
      await reply
        .header('content-disposition', `attachment; filename="${base}.pdf"`)
        .type('application/pdf')
        .send(buffer)
      return
    }
    await reply
      .header('content-disposition', `attachment; filename="${base}.csv"`)
      .type('text/csv; charset=utf-8')
      .send(timesheetToCsv(timesheet, meta))
  }

  // ── Entitlements (REQ-016, ADR-0006/0008) ────────────────────────────────
  @Get('entitlement')
  async getEntitlement(@CurrentUser() user: AuthenticatedUser, @Query() query: AsOfQueryDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return entitlements.getEntitlement(db, workspaceId, query.asOf ?? new Date())
  }

  @Post('entitlement/events')
  async recordEntitlementEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RecordEntitlementEventDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const { recorded } = await entitlements.recordEvent(db, workspaceId, body)
    const entitlement = await entitlements.getEntitlement(db, workspaceId, new Date())
    return { recorded, entitlement }
  }
}
