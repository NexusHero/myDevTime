import { randomUUID } from 'node:crypto'
import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import { balanceFor, debit } from '../billing/contract.js'
import { NlEntryService } from './nl-entry.service.js'
import { SmartAddService } from './smart-add.service.js'
import { AiContext } from './ai.context.js'
import { ASSISTANT, type Assistant } from './assistant.js'
import { AI_INSIGHTS, type AiInsightsPort } from './insights.js'
import { AssistantDto, InsightDto, NlEntryDto, SmartAddDto } from './ai.dto.js'

/** One grounded-assistant answer costs one credit (ADR-0008). */
const ASSISTANT_CREDIT_COST = 1
/** One grounded insight (KI1–KI4) costs one credit, charged only on a real AI proposal. */
const INSIGHT_CREDIT_COST = 1

/**
 * The `ai` module (LLM proposals, NL entry, assistant — ADR-0025/0029). The status
 * route stays unguarded for boundary parity; real AI endpoints run behind
 * `AuthGuard`. NL time entry (REQ-013) returns a **draft only** — the client
 * confirms it before anything is written (ADR-0005).
 */
@ApiTags('ai')
@Controller('api/ai')
export class AiController {
  constructor(
    private readonly nlEntry: NlEntryService,
    private readonly smartAdd: SmartAddService,
    private readonly ctx: AiContext,
    @Inject(ASSISTANT) private readonly assistant: Assistant,
    @Inject(AI_INSIGHTS) private readonly insights: AiInsightsPort,
  ) {}

  @Get('status')
  status(): { module: 'ai'; status: 'ok' } {
    return { module: 'ai', status: 'ok' }
  }

  @Post('nl-entry')
  @UseGuards(AuthGuard)
  async parseNlEntry(@Body() body: NlEntryDto) {
    return this.nlEntry.draft(body.text, body.knownProjects ?? [])
  }

  /**
   * Smart-Add (K6): classify a phrase into a typed draft. Stage 1 is deterministic and
   * free; only a vague phrase reaches the LLM (Stage 2), and even then the re-parsed
   * result is a **draft the user confirms** — nothing is written (ADR-0005). The Stage-2
   * rewrite is metered like the assistant: one credit, only when the AI actually helped.
   */
  @Post('smart-add')
  @UseGuards(AuthGuard)
  async smartAddDraft(@CurrentUser() user: AuthenticatedUser, @Body() body: SmartAddDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const allowAi = (await balanceFor(db, workspaceId)) >= ASSISTANT_CREDIT_COST
    // When AI isn't affordable/allowed we still return the deterministic Stage-1 draft.
    const result = await this.smartAdd.draft(body.text, body.knownProjects ?? [], { allowAi })
    let charged = false
    if (result.source === 'ai-proposal') {
      await debit(db, workspaceId, {
        amount: ASSISTANT_CREDIT_COST,
        category: 'assistant',
        reason: 'Smart-Add AI classification',
        operationId: `smart-add:${workspaceId}:${randomUUID()}`,
      })
      charged = true
    }
    return { ...result, charged }
  }

  /**
   * A grounded insight (KI1–KI4): the LLM phrases the caller's own facts into a coach
   * note, a history-grounded quote, a client-friendly invoice, or meeting follow-ups.
   * One credit is debited only for a real AI proposal (not a deterministic fallback or a
   * refusal), ADR-0008. Violet provenance is the client's job; the source flag drives it.
   */
  @Post('insight')
  @UseGuards(AuthGuard)
  async insight(@CurrentUser() user: AuthenticatedUser, @Body() body: InsightDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const allowAi = (await balanceFor(db, workspaceId)) >= INSIGHT_CREDIT_COST
    const proposal = await this.insights.propose(body.kind, body.facts, { allowAi })
    let charged = false
    if (proposal.source === 'ai-proposal' && !proposal.refused) {
      await debit(db, workspaceId, {
        amount: INSIGHT_CREDIT_COST,
        category: 'assistant',
        reason: `Grounded insight (${proposal.kind})`,
        operationId: `insight:${proposal.kind}:${workspaceId}:${randomUUID()}`,
      })
      charged = true
    }
    return { ...proposal, charged }
  }

  /**
   * The grounded assistant (M2): answers a question only from the caller's supplied
   * facts, the LLM phrasing them (ADR-0005). A credit is debited once for each
   * answered request (not a deterministic fallback or a refusal), ADR-0008. The
   * debit's operationId is a fresh per-request nonce, so each distinct ask is
   * metered exactly once — a permanent per-question key previously let a user
   * re-ask the identical question for unlimited free-but-billable answers. (Client
   * retries of one submission are rare and would at worst re-charge; a
   * client-supplied request id can dedupe them if that ever matters.)
   */
  @Post('assistant')
  @UseGuards(AuthGuard)
  async ask(@CurrentUser() user: AuthenticatedUser, @Body() body: AssistantDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const allowAi = (await balanceFor(db, workspaceId)) >= ASSISTANT_CREDIT_COST
    const answer = await this.assistant.answer(body.question, body.facts, { allowAi })
    let charged = false
    if (answer.source === 'ai-proposal' && !answer.refused) {
      await debit(db, workspaceId, {
        amount: ASSISTANT_CREDIT_COST,
        category: 'assistant',
        reason: 'Grounded assistant answer',
        operationId: `assistant:${workspaceId}:${randomUUID()}`,
      })
      charged = true
    }
    return { source: answer.source, refused: answer.refused, charged, text: answer.text }
  }
}
