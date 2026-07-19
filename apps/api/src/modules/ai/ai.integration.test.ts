import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { creditEntries, timeEntries, workspaces } from '../../db/schema.js'
import { wellbeingDays } from '../../db/wellbeing-schema.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import type { AuthenticatedUser } from '../auth/contract.js'
import { balanceFor, grant } from '../billing/credits-service.js'
import { AiController } from './ai.controller.js'
import { AiContext } from './ai.context.js'
import { NlEntryService } from './nl-entry.service.js'
import { SmartAddService } from './smart-add.service.js'
import { LlmAssistant } from './assistant.js'
import { LlmInsights } from './insights.js'
import { LlmStandupWriter } from './standup.js'
import { LlmCategorizer } from './categorize.js'
import { LlmEstimator } from './estimate.js'
import { LlmMeetingInsights } from './meeting-insights.js'
import { LlmCompanion } from './companion.js'
import { WellbeingService } from '../wellbeing/service.js'
import { NullLlm } from './llm/null-llm.js'
import { LlmUnavailableError, type LlmPort, type LlmRequest, type LlmResult } from './llm/port.js'

/**
 * Acceptance for the credit-priced AI edge (REQ-012/013/015) against a REAL
 * Postgres. The AI controller runs its actual logic — the balance gate, the
 * grounded assistant, and the idempotent credit debit — over the real ledger, so
 * these prove the end-to-end money-affecting flow, not a mock: one grounded AI
 * answer costs exactly one credit; a refusal or the deterministic fallback costs
 * nothing; a workspace with no credits gets no AI and no charge; the metering is
 * workspace-isolated; and NL entry returns a draft only, never persisting a row.
 * The LLM is the one genuinely external system, faked here (ADR-0005/0029 — AI
 * degrades gracefully). Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

/** A controllable LLM stand-in — the faked external. `available()` and the reply text are set per test. */
class FakeLlm implements LlmPort {
  readonly provider = 'openai' as const
  constructor(
    private up: boolean,
    private reply: string,
  ) {}
  available(): Promise<boolean> {
    return Promise.resolve(this.up)
  }
  complete(_request: LlmRequest): Promise<LlmResult> {
    if (!this.up) return Promise.reject(new LlmUnavailableError('openai', 'down'))
    return Promise.resolve({
      text: this.reply,
      usage: { inputTokens: 10, outputTokens: 5 },
      provider: 'openai',
      model: 'fake',
    })
  }
}

describe.skipIf(!databaseUrl)('ai module (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-ai-a'
  const idB = 'itest-ai-b'
  const userA: AuthenticatedUser = {
    id: idA,
    name: 'A',
    email: 'ai-a@itest.local',
    emailVerified: true,
  }
  let wsA = ''
  let wsB = ''

  const ctx = new AiContext(db)
  const facts = ['You tracked 12.5 h this week.', 'Finanzo is 40% over budget.']

  /** The controller wired with a grounded assistant over an available LLM that echoes a fixed answer. */
  function controllerWith(llm: LlmPort): AiController {
    return new AiController(
      new NlEntryService(llm),
      new SmartAddService(llm),
      ctx,
      new LlmAssistant(llm),
      new LlmInsights(llm),
      new LlmStandupWriter(llm),
      new LlmCategorizer(llm),
      new LlmEstimator(llm),
      new LlmMeetingInsights(llm),
      new LlmCompanion(llm),
      new WellbeingService(),
    )
  }

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'ai-a@itest.local'],
      [idB, 'ai-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    await db.delete(creditEntries).where(inArray(creditEntries.workspaceId, [wsA, wsB]))
    await db.delete(wellbeingDays).where(inArray(wellbeingDays.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(timeEntries).where(inArray(timeEntries.workspaceId, [wsA, wsB]))
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  it('Assistant_GroundedAiAnswer_DebitsExactlyOneCredit', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(true, 'You tracked 12.5 hours this week.'))

    const res = await controller.ask(userA, { question: 'How much did I track?', facts })

    expect(res.source).toBe('ai-proposal')
    expect(res.refused).toBe(false)
    expect(res.charged).toBe(true)
    expect(await balanceFor(db, wsA)).toBe(4)
  })

  it('Assistant_AiRefusal_DoesNotCharge', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    // "inbox" is nowhere in the facts → the grounded core recognises it as off-data and refuses
    // deterministically *without* spending a model call (ADR-0005). A refusal is never billed.
    const controller = controllerWith(new FakeLlm(true, 'NO_DATA'))

    const res = await controller.ask(userA, { question: 'What is my inbox count?', facts })

    expect(res.source).toBe('deterministic')
    expect(res.refused).toBe(true)
    expect(res.charged).toBe(false)
    expect(await balanceFor(db, wsA)).toBe(5)
  })

  it('Assistant_NoCredits_SkipsAiAndDoesNotCharge', async () => {
    // Zero balance → the controller passes allowAi:false → the grounded assistant
    // degrades to its deterministic fact match. No AI ran, nothing is charged.
    const controller = controllerWith(new FakeLlm(true, 'irrelevant'))

    const res = await controller.ask(userA, { question: 'How much did I track this week?', facts })

    expect(res.source).toBe('deterministic')
    expect(res.charged).toBe(false)
    expect(await balanceFor(db, wsA)).toBe(0)
  })

  it('Assistant_ProviderDown_DegradesDeterministicallyAndDoesNotCharge', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    // Credits are present, but the provider is unreachable (NullLlm-equivalent): the
    // assistant still answers from the facts deterministically (ADR-0005) and bills nothing.
    const controller = controllerWith(new FakeLlm(false, ''))

    const res = await controller.ask(userA, { question: 'How much did I track this week?', facts })

    expect(res.source).toBe('deterministic')
    expect(res.charged).toBe(false)
    expect(await balanceFor(db, wsA)).toBe(5)
  })

  it('Assistant_CreditMetering_IsWorkspaceIsolated', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(true, 'You tracked 12.5 hours this week.'))

    await controller.ask(userA, { question: 'How much did I track?', facts })

    expect(await balanceFor(db, wsA)).toBe(4)
    expect(await balanceFor(db, wsB)).toBe(0)
  })

  const standupInput = {
    date: '2026-07-18',
    yesterday: [{ label: 'Sync engine', ms: 3 * 3_600_000 }],
    today: [{ label: 'Rules API', ms: 90 * 60_000 }],
    blockers: [],
  }
  // A narrative that repeats every protected figure — 3h, 1h 30m, and the two totals (3h, 1h 30m).
  const goodStandup =
    'Yesterday: 3h on Sync engine. Today: 1h 30m on Rules API. Totals 3h and 1h 30m.'

  it('Standup_AiNarrative_DebitsExactlyOneCredit', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(true, goodStandup))

    const res = await controller.standupReport(userA, standupInput)

    expect(res.source).toBe('ai-proposal')
    expect(res.charged).toBe(true)
    expect(res.report.totalYesterdayMs).toBe(3 * 3_600_000)
    expect(await balanceFor(db, wsA)).toBe(4)
  })

  it('Standup_SlotViolation_FallsBackToPlainAndDoesNotCharge', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    // The model changed a figure (2h instead of 3h) → slot integrity rejects it, no charge.
    const controller = controllerWith(new FakeLlm(true, 'Worked 2h yesterday, some today.'))

    const res = await controller.standupReport(userA, standupInput)

    expect(res.source).toBe('deterministic')
    expect(res.charged).toBe(false)
    expect(await balanceFor(db, wsA)).toBe(5)
  })

  it('Standup_ProviderDown_DegradesToPlainAndDoesNotCharge', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(false, 'unused'))

    const res = await controller.standupReport(userA, standupInput)

    expect(res.source).toBe('deterministic')
    expect(res.charged).toBe(false)
    expect(await balanceFor(db, wsA)).toBe(5)
  })

  it('Standup_MeteringIsWorkspaceIsolated', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(true, goodStandup))

    await controller.standupReport(userA, standupInput)

    expect(await balanceFor(db, wsA)).toBe(4)
    expect(await balanceFor(db, wsB)).toBe(0)
  })

  const categorizeItems = [{ key: 'e1', note: 'finanzo dashboard review', source: 'calendar' }]
  // A valid strict-JSON answer naming a known project (lowercase — canonicalized on parse).
  const goodCategorization =
    '[{"key":"e1","project":"finanzo","tags":["review"],"billable":true,"confidence":"high"}]'

  it('Categorize_AiProposals_DebitsExactlyOneCredit', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(true, goodCategorization))

    const res = await controller.categorize(userA, {
      items: categorizeItems,
      knownProjects: ['Finanzo'],
    })

    expect(res.source).toBe('ai-proposal')
    expect(res.charged).toBe(true)
    expect(res.proposals).toHaveLength(1)
    expect(res.proposals[0]?.project).toBe('Finanzo')
    expect(await balanceFor(db, wsA)).toBe(4)
  })

  it('Categorize_UnknownProject_IsNulledNeverInvented', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    // The model proposes a project that is NOT in the caller's vocabulary — the proposal
    // must carry project: null rather than an invented name (REQ-012, ADR-0005).
    const invented =
      '[{"key":"e1","project":"Atlantis","tags":["review"],"billable":true,"confidence":"high"}]'
    const controller = controllerWith(new FakeLlm(true, invented))

    const res = await controller.categorize(userA, {
      items: categorizeItems,
      knownProjects: ['Finanzo'],
    })

    expect(res.source).toBe('ai-proposal')
    expect(res.proposals[0]?.project).toBeNull()
  })

  it('Categorize_ProviderDown_NoProposalsNoCharge', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(false, 'unused'))

    const res = await controller.categorize(userA, {
      items: categorizeItems,
      knownProjects: ['Finanzo'],
    })

    expect(res.source).toBe('none')
    expect(res.proposals).toEqual([])
    expect(res.charged).toBe(false)
    expect(await balanceFor(db, wsA)).toBe(5)
  })

  it('Categorize_NoCredits_SkipsAiNoCharge', async () => {
    // Zero balance → allowAi:false → the categorizer never runs the model and nothing is charged.
    const controller = controllerWith(new FakeLlm(true, goodCategorization))

    const res = await controller.categorize(userA, {
      items: categorizeItems,
      knownProjects: ['Finanzo'],
    })

    expect(res.source).toBe('none')
    expect(res.charged).toBe(false)
    expect(await balanceFor(db, wsA)).toBe(0)
  })

  // feature/medium → baseline 180–480 min; a valid in-bounds AI proposal.
  const estimateInput = { category: 'feature', complexity: 'medium' } as const
  const goodEstimate = '{"estimateMinutes":300,"rationale":"medium feature, clear scope"}'

  it('Estimate_AiProposal_DebitsExactlyOneCredit', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(true, goodEstimate))

    const res = await controller.estimate(userA, estimateInput)

    expect(res.source).toBe('ai-proposal')
    expect(res.charged).toBe(true)
    expect(res.estimateMinutes).toBe(300)
    expect(res.baselineMin).toBe(180)
    expect(res.baselineMax).toBe(480)
    expect(await balanceFor(db, wsA)).toBe(4)
  })

  it('Estimate_ProviderDown_DegradesToBaselineAndDoesNotCharge', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(false, 'unused'))

    const res = await controller.estimate(userA, estimateInput)

    expect(res.source).toBe('deterministic')
    expect(res.charged).toBe(false)
    expect(res.estimateMinutes).toBe(330)
    expect(await balanceFor(db, wsA)).toBe(5)
  })

  it('Estimate_NoCredits_SkipsAiNoCharge', async () => {
    // Zero balance → allowAi:false → the estimator returns the baseline midpoint, nothing charged.
    const controller = controllerWith(new FakeLlm(true, goodEstimate))

    const res = await controller.estimate(userA, estimateInput)

    expect(res.source).toBe('deterministic')
    expect(res.charged).toBe(false)
    expect(await balanceFor(db, wsA)).toBe(0)
  })

  it('Estimate_MeteringIsWorkspaceIsolated', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(true, goodEstimate))

    await controller.estimate(userA, estimateInput)

    expect(await balanceFor(db, wsA)).toBe(4)
    expect(await balanceFor(db, wsB)).toBe(0)
  })

  const meetingSegments = [
    { speaker: 'Ann', startMs: 0, endMs: 1000, text: 'We will ship the pricing API on Friday.' },
    { speaker: 'Ben', startMs: 1000, endMs: 2000, text: 'Ben should review the migration PR.' },
  ]

  it('MeetingInsights_AiSummary_DebitsExactlyOneCreditAndReturnsConfirmedOnlyActions', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(true, 'The team agreed to ship the pricing API.'))

    const res = await controller.meetingInsightsReview(userA, { segments: meetingSegments })

    expect(res.summary.source).toBe('ai-proposal')
    expect(res.summary.charged).toBe(true)
    expect(res.facts.length).toBeGreaterThan(0)
    expect(res.actionItems.every(a => (a.provenance as string) === 'ai-proposal')).toBe(true)
    expect(await balanceFor(db, wsA)).toBe(4)
  })

  it('MeetingInsights_ProviderDown_DeterministicSummaryDoesNotCharge', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(false, 'unused'))

    const res = await controller.meetingInsightsReview(userA, { segments: meetingSegments })

    expect(res.summary.source).toBe('deterministic')
    expect(res.summary.charged).toBe(false)
    expect(await balanceFor(db, wsA)).toBe(5)
  })

  it('MeetingInsights_MeteringIsWorkspaceIsolated', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(true, 'The team agreed to ship the pricing API.'))

    await controller.meetingInsightsReview(userA, { segments: meetingSegments })

    expect(await balanceFor(db, wsA)).toBe(4)
    expect(await balanceFor(db, wsB)).toBe(0)
  })

  const companionDay = {
    plannedMinutes: 360,
    actualMinutes: 600,
    overtimeMinutes: 90,
    breakShortfallMinutes: 30,
    meetingCount: 6,
    backToBackMeetingCount: 3,
    planDriftMinutes: 240,
    isAbsenceDay: false,
  }
  const goodCompanion = JSON.stringify({
    narration: 'A full one — let it go for the evening.',
    suggestion: 'Guard your first hour tomorrow.',
  })

  it('EveningCompanion_AiNarration_DebitsExactlyOneCredit', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(true, goodCompanion))

    const res = await controller.eveningCompanion(userA, { date: '2026-07-18', day: companionDay })

    expect(res.message.source).toBe('ai-proposal')
    expect(res.message.charged).toBe(true)
    // the deterministic core still owns the numbers on the AI path
    expect(res.review.loadLevel).toBe('overload')
    expect(res.suggestion?.provenance).toBe('ai-proposal')
    expect(await balanceFor(db, wsA)).toBe(4)
  })

  it('EveningCompanion_ProviderDown_DegradesFreeAndDoesNotCharge', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const controller = controllerWith(new FakeLlm(false, 'unused'))

    const res = await controller.eveningCompanion(userA, { date: '2026-07-18', day: companionDay })

    expect(res.message.source).toBe('deterministic')
    expect(res.message.charged).toBe(false)
    expect(res.review.signals.length).toBeGreaterThan(0)
    expect(await balanceFor(db, wsA)).toBe(5)
  })

  it('NlEntry_DeterministicParse_ReturnsDraftAndPersistsNothing', async () => {
    const controller = controllerWith(new NullLlm())

    const res = await controller.parseNlEntry({
      text: '2h Finanzo review',
      knownProjects: ['Finanzo'],
    })

    expect(res.source).toBe('deterministic')
    expect(res.draft).not.toBeNull()
    // REQ-013: a draft the user confirms — the endpoint writes no entry of its own.
    const rows = await db.select().from(timeEntries).where(eq(timeEntries.workspaceId, wsA))
    expect(rows).toHaveLength(0)
  })

  it('NlEntry_ProviderDownAndUnparseable_DegradesToNone', async () => {
    // No duration for the deterministic parser and the provider is down → the
    // service degrades to `none` rather than failing (REQ-012 graceful degradation).
    const controller = controllerWith(new NullLlm())

    const res = await controller.parseNlEntry({ text: 'thinking about the roadmap' })

    expect(res.source).toBe('none')
    expect(res.draft).toBeNull()
  })
})
