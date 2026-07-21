import { randomUUID } from 'node:crypto'
import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { moodScoreOf, zonedTimeToInstant } from '@mydevtime/domain'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import { balanceFor, debit } from '../billing/contract.js'
import type { Db } from '../../db/client.js'
import { listShifts, worktimeSummary } from '../worktime/contract.js'
import { getPreferences } from '../preferences/contract.js'
import { WellbeingService } from '../wellbeing/service.js'
import { NlEntryService } from './nl-entry.service.js'
import { SmartAddService } from './smart-add.service.js'
import { AiContext } from './ai.context.js'
import { ASSISTANT, type Assistant } from './assistant.js'
import { AI_INSIGHTS, type AiInsightsPort } from './insights.js'
import { STANDUP_WRITER, type StandupWriter } from './standup.js'
import { CATEGORIZER, type Categorizer } from './categorize.js'
import { ESTIMATOR, type Estimator } from './estimate.js'
import { MEETING_INSIGHTS, type MeetingInsightsService } from './meeting-insights.js'
import {
  COMPANION,
  companionDayLoadScore,
  type CompanionDayInput,
  type CompanionService,
} from './companion.js'
import {
  AssistantDto,
  CategorizeDto,
  EstimateDto,
  EveningCompanionDto,
  InsightDto,
  MeetingInsightsDto,
  NlEntryDto,
  SmartAddDto,
  StandupDto,
} from './ai.dto.js'

/** One grounded-assistant answer costs one credit (ADR-0008). */
const ASSISTANT_CREDIT_COST = 1
/** One grounded insight (KI1–KI4) costs one credit, charged only on a real AI proposal. */
const INSIGHT_CREDIT_COST = 1
/** One AI standup narration costs one credit, charged only on a real AI proposal (ADR-0008). */
const STANDUP_CREDIT_COST = 1
/** One categorization batch costs one credit, charged only when the AI actually proposed (ADR-0008). */
const CATEGORIZE_CREDIT_COST = 1
/** One AI task-estimate review costs one credit, charged only on a real AI proposal (ADR-0008). */
const ESTIMATE_CREDIT_COST = 1
/** One AI meeting summary costs one credit, charged only on a real AI proposal (ADR-0008). */
const MEETING_INSIGHTS_CREDIT_COST = 1
/** One AI evening-companion narration costs one credit, charged only on a real AI proposal (ADR-0008). */
const COMPANION_CREDIT_COST = 1
/** How many of the person's most-recent persisted days the wellbeing baseline is calibrated over. */
const COMPANION_HISTORY_DAYS = 90
/**
 * How many most-recent stored mood rows the companion scans for the reviewed day's word. Mood
 * rows come back newest-first, so the reviewed day sits at/near the head — a month of rows is
 * ample headroom without reading the whole history for a single-day lookup.
 */
const COMPANION_MOOD_LOOKBACK_DAYS = 31

/** Absolute `[from, to)` instants of the local calendar day `date` in `tz` (DST-safe via the core). */
function localDayWindow(date: string, tz: string): { from: Date; to: Date } {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const from = new Date(zonedTimeToInstant({ year, month, day, hour: 0, minute: 0, second: 0 }, tz))
  // Next calendar day (UTC arithmetic rolls month/year over cleanly), re-localised in `tz`.
  const nextUtc = new Date(Date.UTC(year, month - 1, day + 1))
  const to = new Date(
    zonedTimeToInstant(
      {
        year: nextUtc.getUTCFullYear(),
        month: nextUtc.getUTCMonth() + 1,
        day: nextUtc.getUTCDate(),
        hour: 0,
        minute: 0,
        second: 0,
      },
      tz,
    ),
  )
  return { from, to }
}

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
    @Inject(STANDUP_WRITER) private readonly standup: StandupWriter,
    @Inject(CATEGORIZER) private readonly categorizer: Categorizer,
    @Inject(ESTIMATOR) private readonly estimator: Estimator,
    @Inject(MEETING_INSIGHTS) private readonly meetingInsights: MeetingInsightsService,
    @Inject(COMPANION) private readonly companion: CompanionService,
    private readonly wellbeing: WellbeingService,
  ) {}

  /**
   * The day's real overtime + missed-break minutes from the caller's own worktime feed, or `null`
   * when the day holds no completed shift (the caller then falls back to the request's own values).
   * Overtime is the positive part of the day's balance (worked − target); the break shortfall is the
   * ArbZG deficit summed across the day's shifts. Every number is the deterministic worktime core's
   * (ADR-0005); this only sums and windows. Workspace-scoped by construction.
   */
  private async sourceDaySignals(
    db: Db,
    workspaceId: string,
    date: string,
    tz: string,
  ): Promise<{ overtimeMinutes: number; breakShortfallMinutes: number } | null> {
    const window = localDayWindow(date, tz)
    const shifts = await listShifts(db, workspaceId, window)
    if (shifts.length === 0) return null
    const balance = await worktimeSummary(db, workspaceId, {
      from: window.from,
      to: window.to,
      tz,
      asOf: window.to,
    })
    const overtimeMinutes = Math.max(0, Math.round(balance.balanceMs / 60_000))
    const breakShortfallMs = shifts.reduce((sum, s) => sum + s.breakShortfallMs, 0)
    const breakShortfallMinutes = Math.round(breakShortfallMs / 60_000)
    return { overtimeMinutes, breakShortfallMinutes }
  }

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
    // REQ-026: the optional custom focus biases emphasis only — the grounding rules win.
    const proposal = await this.insights.propose(body.kind, body.facts, {
      allowAi,
      customPrompt: body.customPrompt,
    })
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
   * The AI standup / summary (REQ-014): the caller's own grouped durations are arranged into a
   * slot-protected report and the LLM narrates around the numbers — never changing one (slot
   * integrity, ADR-0005). A credit is debited once only when the AI actually wrote the narrative;
   * a down provider, no credits, an empty day, or a draft that dropped a figure all degrade to the
   * free plain template. Read-only: nothing is written to the timesheet.
   */
  @Post('standup')
  @UseGuards(AuthGuard)
  async standupReport(@CurrentUser() user: AuthenticatedUser, @Body() body: StandupDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const allowAi = (await balanceFor(db, workspaceId)) >= STANDUP_CREDIT_COST
    const result = await this.standup.compose(
      {
        date: body.date,
        yesterday: body.yesterday ?? [],
        today: body.today ?? [],
        blockers: body.blockers ?? [],
      },
      { allowAi },
    )
    let charged = false
    if (result.source === 'ai-proposal') {
      await debit(db, workspaceId, {
        amount: STANDUP_CREDIT_COST,
        category: 'assistant',
        reason: 'AI standup narrative',
        operationId: `standup:${workspaceId}:${body.date}:${randomUUID()}`,
      })
      charged = true
    }
    return { source: result.source, text: result.text, report: result.report, charged }
  }

  /**
   * AI categorization proposals (REQ-012, #17): the LLM proposes a project (strictly out
   * of the caller's `knownProjects` — never invented), tags, billability and a confidence
   * per uncategorized entry. Proposals only — the client confirms before anything is
   * written, and confirmed entries carry `ai-proposal` provenance (ADR-0005). One credit
   * is debited only when the AI actually produced at least one proposal; a down provider,
   * no credits, or an unparseable completion degrade to `none` and cost nothing (ADR-0008).
   */
  @Post('categorize')
  @UseGuards(AuthGuard)
  async categorize(@CurrentUser() user: AuthenticatedUser, @Body() body: CategorizeDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const allowAi = (await balanceFor(db, workspaceId)) >= CATEGORIZE_CREDIT_COST
    const result = await this.categorizer.compose(body.items, body.knownProjects ?? [], {
      allowAi,
    })
    let charged = false
    if (result.source === 'ai-proposal' && result.proposals.length > 0) {
      await debit(db, workspaceId, {
        amount: CATEGORIZE_CREDIT_COST,
        category: 'assistant',
        reason: 'AI categorization proposals',
        operationId: `categorize:${workspaceId}:${randomUUID()}`,
      })
      charged = true
    }
    return { source: result.source, charged, proposals: result.proposals }
  }

  /**
   * AI task-estimate review (REQ-041, #90): the deterministic baseline range for the task's
   * category + complexity grounds and bounds an optional AI adjustment (the LLM proposes a single
   * minute estimate, clamped into a sane multiple of the baseline — it can nudge, never fabricate,
   * ADR-0005). One credit is debited only when the AI actually proposed; a down provider, no
   * credits, or an unparseable completion degrade to the free baseline midpoint (ADR-0008).
   * Proposal-only: nothing is written — the client confirms via the existing `setTaskEstimate`.
   */
  @Post('estimate')
  @UseGuards(AuthGuard)
  async estimate(@CurrentUser() user: AuthenticatedUser, @Body() body: EstimateDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const allowAi = (await balanceFor(db, workspaceId)) >= ESTIMATE_CREDIT_COST
    const result = await this.estimator.compose(
      {
        category: body.category,
        complexity: body.complexity,
        note: body.note,
        samples: body.samples,
      },
      { allowAi },
    )
    let charged = false
    if (result.source === 'ai-proposal') {
      await debit(db, workspaceId, {
        amount: ESTIMATE_CREDIT_COST,
        category: 'assistant',
        reason: 'AI task-estimate review',
        operationId: `estimate:${workspaceId}:${randomUUID()}`,
      })
      charged = true
    }
    return {
      source: result.source,
      charged,
      estimateMinutes: result.estimateMinutes,
      rationale: result.rationale,
      baselineMin: result.baselineMin,
      baselineMax: result.baselineMax,
    }
  }

  /**
   * Meeting insights over a supplied transcript (REQ-026, #33): grounded fact lines and
   * **confirmed-only** action-item proposals come back deterministically and free (never
   * auto-created — the client creates a task only when the user confirms one via
   * `POST /api/tracking/tasks`). An optional AI summary is grounded in the transcript with the
   * caller's `customPrompt` biasing emphasis only; one credit is debited only when that AI summary
   * is produced. A down provider or no credits degrade to a deterministic summary and cost nothing.
   */
  @Post('meeting-insights')
  @UseGuards(AuthGuard)
  async meetingInsightsReview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MeetingInsightsDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const allowAi = (await balanceFor(db, workspaceId)) >= MEETING_INSIGHTS_CREDIT_COST
    const result = await this.meetingInsights.compose(body.segments, {
      allowAi,
      customPrompt: body.customPrompt,
    })
    let charged = false
    if (result.summary.source === 'ai-proposal') {
      await debit(db, workspaceId, {
        amount: MEETING_INSIGHTS_CREDIT_COST,
        category: 'assistant',
        reason: 'AI meeting summary',
        operationId: `meeting-insights:${workspaceId}:${randomUUID()}`,
      })
      charged = true
    }
    return {
      summary: { source: result.summary.source, text: result.summary.text, charged },
      facts: result.facts,
      actionItems: result.actionItems,
    }
  }

  /**
   * The Evening Companion (design v14 §H, REQ-065, ADR-0005): the deterministic wellbeing core
   * (`reviewDay` + `computeBaseline`) runs over the caller's own day — free, and the source of every
   * number returned. The day's `overtimeMinutes`/`breakShortfallMinutes` are sourced from the caller's
   * real worktime feed (the request's own values are only a fallback when no shift was recorded that
   * day); the day's load is then **recorded** (an idempotent upsert), and the baseline is calibrated
   * over the person's own **persisted** load series — not a client-supplied history. On top, the LLM
   * weaves those grounded facts into one warm evening paragraph plus one gentle forward suggestion; a
   * credit is debited once only when that AI narration is produced. A down provider, no credits, an
   * absence day, or an unusable reply degrade to a still-caring deterministic template built from the
   * same signals and cost nothing. Nothing is booked or planned — the suggestion is a proposal the
   * client confirms (ADR-0005). The reviewed day's stored punch-out mood is woven in **only** under
   * the explicit `moodConsent` preference (REQ-068, ADR-0071), mapped through the fixed
   * `moodScoreOf`; without consent or a stored word, `moodScore` stays honestly absent — and the
   * mood value itself is never logged on this path.
   */
  @Post('evening-companion')
  @UseGuards(AuthGuard)
  async eveningCompanion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: EveningCompanionDto,
  ) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    const userId = user.id
    const tz = body.tz ?? 'UTC'
    // (a) Source the day's real overtime/break from the worktime feed; keep the request's own values
    //     only as a fallback when the day holds no completed shift.
    const feed = await this.sourceDaySignals(db, workspaceId, body.date, tz)
    const fedDay: CompanionDayInput =
      feed === null
        ? body.day
        : {
            ...body.day,
            overtimeMinutes: feed.overtimeMinutes,
            breakShortfallMinutes: feed.breakShortfallMinutes,
          }
    // (a2) Weave the reviewed day's stored punch-out mood in (REQ-068, ADR-0071): only under the
    //     explicit moodConsent opt-in and only when that day actually holds a stored word — the
    //     stored word (via the fixed moodScoreOf) then wins over any client-supplied score;
    //     otherwise moodScore stays exactly as the request sent it (usually absent). The word is
    //     read through the existing consented store and never logged.
    const prefs = await getPreferences(db, workspaceId, userId)
    const storedMood = prefs.moodConsent
      ? (
          await this.wellbeing.moodHistory(
            db,
            { workspaceId, userId },
            COMPANION_MOOD_LOOKBACK_DAYS,
          )
        ).find(m => m.day === body.date)
      : undefined
    const day: CompanionDayInput =
      storedMood === undefined ? fedDay : { ...fedDay, moodScore: moodScoreOf(storedMood.mood) }
    // (b) Record today's deterministic load (upsert) so the baseline runs over a real per-day history.
    await this.wellbeing.recordDayLoad(db, {
      workspaceId,
      userId,
      day: body.date,
      loadScore: companionDayLoadScore(day),
    })
    // (c) Calibrate the baseline over the person's own persisted series (now including today).
    const history = await this.wellbeing.recentLoadHistory(
      db,
      { workspaceId, userId },
      COMPANION_HISTORY_DAYS,
    )
    const allowAi = (await balanceFor(db, workspaceId)) >= COMPANION_CREDIT_COST
    const result = await this.companion.compose(day, history, { allowAi })
    let charged = false
    if (result.message.source === 'ai-proposal') {
      await debit(db, workspaceId, {
        amount: COMPANION_CREDIT_COST,
        category: 'assistant',
        reason: 'AI evening companion narration',
        operationId: `evening-companion:${workspaceId}:${randomUUID()}`,
      })
      charged = true
    }
    return {
      review: result.review,
      baseline: result.baseline,
      message: { source: result.message.source, text: result.message.text, charged },
      ...(result.suggestion !== undefined ? { suggestion: result.suggestion } : {}),
    }
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
