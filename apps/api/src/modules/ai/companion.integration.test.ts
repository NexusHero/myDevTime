import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import {
  attendanceShifts,
  creditEntries,
  timeEntries,
  workSchedules,
  workspaces,
} from '../../db/schema.js'
import { wellbeingDays, wellbeingMoods } from '../../db/wellbeing-schema.js'
import { userPreferences } from '../../db/schema.js'
import { setPreferences } from '../preferences/service.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import type { AuthenticatedUser } from '../auth/contract.js'
import { createShift, setSchedule } from '../worktime/service.js'
import { WellbeingService } from '../wellbeing/service.js'
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
import { NullLlm } from './llm/null-llm.js'

/**
 * Acceptance for the completed Evening Companion wellbeing vertical (REQ-065) against a REAL Postgres.
 * These prove the two honest gaps are now closed by real persistence + a real feed: (1) the baseline
 * is calibrated over the person's own **persisted** per-day load history — a recorded day feeds the
 * next call — not a client-supplied series; (2) the day's overtime/break come from the caller's real
 * **worktime feed**, not the request's zeros; and (3) another workspace's days never leak into a
 * caller's baseline (workspace isolation by construction, ADR-0015). Proposal-only is unchanged
 * (ADR-0005): nothing is booked. Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

const wellbeing = new WellbeingService()

/** The heavy day the companion narrates; overtime/break here are request *fallbacks* only. */
const heavyDay = {
  plannedMinutes: 360,
  actualMinutes: 600,
  overtimeMinutes: 0,
  breakShortfallMinutes: 0,
  meetingCount: 6,
  backToBackMeetingCount: 3,
  planDriftMinutes: 240,
  isAbsenceDay: false,
}

describe.skipIf(!databaseUrl)('Evening Companion wellbeing vertical (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-companion-a'
  const idB = 'itest-companion-b'
  const userA: AuthenticatedUser = {
    id: idA,
    name: 'CompA',
    email: 'companion-a@itest.local',
    emailVerified: true,
  }
  let wsA = ''
  let wsB = ''

  const ctx = new AiContext(db)

  /** A controller wired with a provider-down LLM — the companion degrades free; the DB paths are real. */
  function controller(): AiController {
    const llm = new NullLlm()
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
      wellbeing,
    )
  }

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'companion-a@itest.local'],
      [idB, 'companion-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'CompA')
    wsB = await resolveWorkspaceId(db, idB, 'CompB')
  })

  afterEach(async () => {
    await db.delete(wellbeingDays).where(inArray(wellbeingDays.workspaceId, [wsA, wsB]))
    await db.delete(wellbeingMoods).where(inArray(wellbeingMoods.workspaceId, [wsA, wsB]))
    await db.delete(userPreferences).where(inArray(userPreferences.workspaceId, [wsA, wsB]))
    await db.delete(attendanceShifts).where(inArray(attendanceShifts.workspaceId, [wsA, wsB]))
    await db.delete(workSchedules).where(inArray(workSchedules.workspaceId, [wsA, wsB]))
    await db.delete(creditEntries).where(inArray(creditEntries.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(timeEntries).where(inArray(timeEntries.workspaceId, [wsA, wsB]))
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  it('RecordedDays_FeedTheNextCallsBaseline', async () => {
    // Six persisted days climbing oldest→newest; with today's recorded heavy day that is ≥ the 5-day
    // minimum and a clearly rising series — so the baseline reflects the *persisted* history.
    const seed: [string, number][] = [
      ['2026-07-01', 1],
      ['2026-07-02', 1],
      ['2026-07-03', 2],
      ['2026-07-04', 6],
      ['2026-07-05', 7],
      ['2026-07-06', 8],
    ]
    for (const [day, loadScore] of seed) {
      await wellbeing.recordDayLoad(db, { workspaceId: wsA, userId: idA, day, loadScore })
    }

    const res = await controller().eveningCompanion(userA, { date: '2026-07-10', day: heavyDay })

    // A finite band + a rising trend can only come from the persisted series (an empty history would
    // yield the wide `[0, ∞)` default and a steady trend).
    expect(Number.isFinite(res.baseline.normalHigh)).toBe(true)
    expect(res.baseline.trend).toBe('rising')
    // Today was recorded (upsert), so the workspace now holds the six seeded days plus today.
    const rows = await db.select().from(wellbeingDays).where(eq(wellbeingDays.workspaceId, wsA))
    expect(rows).toHaveLength(seed.length + 1)
  })

  it('RecordingADay_IsIdempotent_UpsertNotDoubleCount', async () => {
    // Two evening opens for the SAME day must upsert, leaving exactly one row for that day.
    await controller().eveningCompanion(userA, { date: '2026-07-11', day: heavyDay })
    await controller().eveningCompanion(userA, { date: '2026-07-11', day: heavyDay })

    const rows = await db.select().from(wellbeingDays).where(eq(wellbeingDays.workspaceId, wsA))
    expect(rows).toHaveLength(1)
  })

  it('OvertimeAndBreak_ComeFromTheWorktimeFeed_NotTheRequestZeros', async () => {
    // An 8h/day target and a real 10h shift with no break on the reviewed day → the deterministic
    // worktime core yields 120 min overtime (10h − 8h) and a 45 min ArbZG break shortfall.
    await setSchedule(db, wsA, {
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      weeklyTargetMs: [8, 8, 8, 8, 8, 8, 8].map(h => h * 3_600_000),
    })
    await createShift(db, wsA, idA, {
      startedAt: new Date('2026-07-15T08:00:00Z'),
      endedAt: new Date('2026-07-15T18:00:00Z'),
      breakMs: 0,
    })

    // The request carries zeros for overtime/break — the feed must override them.
    const res = await controller().eveningCompanion(userA, {
      date: '2026-07-15',
      tz: 'UTC',
      day: heavyDay,
    })

    const overtime = res.review.signals.find(s => s.kind === 'overtime')
    const breakShort = res.review.signals.find(s => s.kind === 'break-shortfall')
    expect(overtime?.kind === 'overtime' ? overtime.detail.overtimeMinutes : 0).toBe(120)
    expect(breakShort?.kind === 'break-shortfall' ? breakShort.detail.shortfallMinutes : 0).toBe(45)
  })

  it('WorktimeFeedEmpty_FallsBackToTheRequestValues', async () => {
    // No shift on the reviewed day → the feed is empty → the request's own overtime/break stand.
    const res = await controller().eveningCompanion(userA, {
      date: '2026-07-16',
      tz: 'UTC',
      day: { ...heavyDay, overtimeMinutes: 90, breakShortfallMinutes: 30 },
    })

    const overtime = res.review.signals.find(s => s.kind === 'overtime')
    const breakShort = res.review.signals.find(s => s.kind === 'break-shortfall')
    expect(overtime?.kind === 'overtime' ? overtime.detail.overtimeMinutes : 0).toBe(90)
    expect(breakShort?.kind === 'break-shortfall' ? breakShort.detail.shortfallMinutes : 0).toBe(30)
  })

  it('Baseline_IsWorkspaceIsolated_OtherWorkspaceDaysNeverLeak', async () => {
    // Workspace B has a long, heavy persisted history…
    for (const day of [
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
      '2026-07-06',
    ]) {
      await wellbeing.recordDayLoad(db, { workspaceId: wsB, userId: idB, day, loadScore: 9 })
    }

    // …but caller A (no prior days) sees only their own single recorded day → the wide default band.
    const res = await controller().eveningCompanion(userA, { date: '2026-07-10', day: heavyDay })

    expect(res.baseline.normalHigh).toBe(Number.POSITIVE_INFINITY)
    expect(res.baseline.trend).toBe('steady')
    // A's series holds exactly today; B's six days are untouched — no cross-workspace leak.
    const aRows = await db.select().from(wellbeingDays).where(eq(wellbeingDays.workspaceId, wsA))
    const bRows = await db.select().from(wellbeingDays).where(eq(wellbeingDays.workspaceId, wsB))
    expect(aRows).toHaveLength(1)
    expect(bRows).toHaveLength(6)
  })

  it('StoredConsentedMood_FeedsTheLowMoodSignal_AndStaysAbsentWithoutOne', async () => {
    // The mood-pattern weave (REQ-068, ADR-0071): with the explicit opt-in stored and a
    // 'stressed' word recorded for the reviewed day, the companion's review must carry the
    // low-mood signal at the fixed moodScoreOf mapping (stressed → 1)…
    await setPreferences(db, wsA, idA, { moodConsent: true })
    await wellbeing.recordMood(db, {
      workspaceId: wsA,
      userId: idA,
      day: '2026-07-17',
      mood: 'stressed',
    })

    const withMood = await controller().eveningCompanion(userA, {
      date: '2026-07-17',
      day: heavyDay,
    })
    const low = withMood.review.signals.find(s => s.kind === 'low-mood')
    expect(low?.kind === 'low-mood' ? low.detail.moodScore : 0).toBe(1)

    // …and a day with NO stored word leaves moodScore honestly absent, exactly as before the
    // weave — the companion never guesses a mood the person didn't log.
    const withoutMood = await controller().eveningCompanion(userA, {
      date: '2026-07-18',
      day: heavyDay,
    })
    expect(withoutMood.review.signals.some(s => s.kind === 'low-mood')).toBe(false)
  })
})
