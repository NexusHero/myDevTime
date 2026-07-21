import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import { balanceFor, debit } from '../billing/contract.js'
import * as svc from './service.js'
import { PlannerContext } from './planner.context.js'
import { PLAN_LABELER, type PlanLabeler } from './labeler.js'
import { PLAN_BRIEFER, type PlanBriefer } from './briefer.js'
import {
  ApplyProposalDto,
  GeneratePlanDto,
  IdParamDto,
  PlanDateQueryDto,
  PlanStatusDto,
  ProtectedDayQueryDto,
} from './planner.dto.js'

/** One AI Co-Planner briefing costs one credit (ADR-0008). */
const LABEL_CREDIT_COST = 1
/** One AI day-briefing costs one credit (ADR-0008). */
const BRIEFING_CREDIT_COST = 1

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
  constructor(
    private readonly ctx: PlannerContext,
    @Inject(PLAN_LABELER) private readonly labeler: PlanLabeler,
    @Inject(PLAN_BRIEFER) private readonly briefer: PlanBriefer,
  ) {}

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

  /**
   * The plan-apply seam (ADR-0071 P4, REQ-070): apply ONE user-confirmed Sevi proposal.
   * `protect-time` books a durable 🛡 window (idempotent — a repeated confirm cannot stack);
   * `move-block`/`shrink-block` run the pure domain mutation and persist a NEW accepted plan
   * version. Only ever called on confirmation — Sevi itself can never book (ADR-0005).
   */
  @Post('apply')
  @HttpCode(200)
  async apply(@CurrentUser() user: AuthenticatedUser, @Body() body: ApplyProposalDto) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    const proposal = body.proposal
    if (proposal.kind === 'protect-time') {
      await svc.addProtectedTime(db, workspaceId, userId, {
        day: proposal.day,
        startMin: proposal.startMin,
        endMin: proposal.endMin,
      })
      return { applied: { proposal } }
    }
    // Batch kinds of the daily loop (ADR-0072): one-tap repair + fill-week/first-run — the
    // same confirm-only seam, with the applying feature recorded as the version's source.
    if (proposal.kind === 'relayout-day') {
      const plan = await svc.applyRelayout(
        db,
        workspaceId,
        userId,
        proposal.planId,
        proposal.placements,
        proposal.provenance,
      )
      return { applied: { proposal, resultPlanId: plan.id } }
    }
    if (proposal.kind === 'add-blocks') {
      const plan = await svc.applyAddBlocks(
        db,
        workspaceId,
        userId,
        proposal.day,
        // exactOptionalPropertyTypes: an absent taskId stays absent, never `undefined`.
        proposal.blocks.map(b => ({
          startMin: b.startMin,
          lenMin: b.lenMin,
          kind: b.kind,
          label: b.label,
          ...(b.taskId === undefined ? {} : { taskId: b.taskId }),
        })),
        proposal.provenance,
      )
      return { applied: { proposal, resultPlanId: plan.id } }
    }
    const plan = await svc.applyBlockMutation(db, workspaceId, userId, proposal.planId, proposal)
    return { applied: { proposal, resultPlanId: plan.id } }
  }

  /** The caller's 🛡 protected windows for a day — nudge gating + rendering need them. */
  @Get('protected')
  async protectedForDay(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProtectedDayQueryDto,
  ) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return svc.protectedTimesFor(db, workspaceId, userId, query.day)
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

  /**
   * The AI Co-Planner *garnish* (REQ-031, #151): rank/label a stored plan's blocks.
   * The LLM only labels the code-enforced blocks (ADR-0005); it degrades to the
   * deterministic labels when the provider is down or the workspace has no credits.
   * A credit is debited only when the AI actually produced the labels, idempotently
   * per plan, so re-labeling the same plan never double-charges (ADR-0008).
   */
  /**
   * The evening review (REQ-031, #151): plan-vs-actual focus for a stored plan,
   * computed by the deterministic core. Read-only, no credit.
   */
  @Get('plans/:id/review')
  async review(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return svc.reviewPlan(db, workspaceId, params.id)
  }

  @Post('plans/:id/label')
  async label(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const plan = svc.planRowToDayPlan(await svc.getPlanById(db, workspaceId, params.id))
    const allowAi = (await balanceFor(db, workspaceId)) >= LABEL_CREDIT_COST
    const { source, labels } = await this.labeler.label(plan, { allowAi })
    let charged = false
    if (source === 'ai-proposal') {
      await debit(db, workspaceId, {
        amount: LABEL_CREDIT_COST,
        category: 'co-planner',
        reason: 'AI Co-Planner briefing',
        operationId: `plan-label:${params.id}`,
      })
      charged = true
    }
    return { source, charged, labels }
  }

  /**
   * The AI day-briefing (M8): a short coaching text over the placed plan. Grounded
   * in the plan's facts (ADR-0005) and degrades to a factual deterministic summary
   * when the provider is down or the workspace has no credits. A credit is debited
   * only when the AI actually wrote the briefing, idempotently per plan.
   */
  @Post('plans/:id/briefing')
  async briefing(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const plan = svc.planRowToDayPlan(await svc.getPlanById(db, workspaceId, params.id))
    const allowAi = (await balanceFor(db, workspaceId)) >= BRIEFING_CREDIT_COST
    const { source, text } = await this.briefer.brief(plan, { allowAi })
    let charged = false
    if (source === 'ai-proposal') {
      await debit(db, workspaceId, {
        amount: BRIEFING_CREDIT_COST,
        category: 'co-planner',
        reason: 'AI day-briefing',
        operationId: `plan-briefing:${params.id}`,
      })
      charged = true
    }
    return { source, charged, text }
  }
}
