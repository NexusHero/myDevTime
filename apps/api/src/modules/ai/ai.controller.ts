import { randomUUID } from 'node:crypto'
import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import { balanceFor, debit } from '../billing/contract.js'
import { NlEntryService } from './nl-entry.service.js'
import { AiContext } from './ai.context.js'
import { ASSISTANT, type Assistant } from './assistant.js'
import { AssistantDto, NlEntryDto } from './ai.dto.js'

/** One grounded-assistant answer costs one credit (ADR-0008). */
const ASSISTANT_CREDIT_COST = 1

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
    private readonly ctx: AiContext,
    @Inject(ASSISTANT) private readonly assistant: Assistant,
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
