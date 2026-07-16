import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { creditEntries, plans, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import type { AuthenticatedUser } from '../auth/contract.js'
import {
  LlmUnavailableError,
  type LlmPort,
  type LlmRequest,
  type LlmResult,
} from '../ai/contract.js'
import { balanceFor, grant } from '../billing/credits-service.js'
import { PlannerController } from './planner.controller.js'
import { PlannerContext } from './planner.context.js'
import { DeterministicPlanLabeler } from './labeler.js'
import { LlmPlanBriefer } from './briefer.js'
import * as svc from './service.js'

/**
 * Acceptance for the credit-priced AI **day-briefing** (M8, REQ-014) against a
 * REAL Postgres. The planner controller runs its actual logic — the balance gate,
 * the LLM-backed briefer over the provider-agnostic port, and the idempotent
 * credit debit — over the real ledger, so these prove the money-affecting flow end
 * to end, not a mock: one AI briefing costs exactly one credit and re-briefing the
 * same plan never double-charges; a provider that is down degrades to the factual
 * deterministic summary and charges nothing; a workspace with no credits gets no
 * AI and no charge; and the metering is workspace-isolated. The HTTP surface is
 * guarded (401 without a session). The LLM is the one genuinely external system,
 * faked here (ADR-0005/0029 — AI degrades gracefully). Skips without DATABASE_URL;
 * CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

/** A controllable LLM stand-in — the faked external. `up` toggles availability. */
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

describe.skipIf(!databaseUrl)('planner day-briefing (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-brief-a'
  const idB = 'itest-brief-b'
  const userA: AuthenticatedUser = {
    id: idA,
    name: 'A',
    email: 'brief-a@itest.local',
    emailVerified: true,
  }
  let wsA = ''
  let wsB = ''

  const ctx = new PlannerContext(db)

  /** The controller wired with the real context + a briefer over the given LLM. */
  function controllerWith(llm: LlmPort): PlannerController {
    return new PlannerController(ctx, new DeterministicPlanLabeler(), new LlmPlanBriefer(llm))
  }

  const input = {
    date: '2026-07-10',
    plan: {
      dayStartMin: 8 * 60,
      dayEndMin: 18 * 60,
      anchors: [{ startMin: 9 * 60, lenMin: 30, label: 'Daily' }],
      backlog: [{ id: 't1', label: 'Sync engine', estimateMin: 180, priority: 1 }],
    },
  }

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'brief-a@itest.local'],
      [idB, 'brief-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    await db.delete(creditEntries).where(inArray(creditEntries.workspaceId, [wsA, wsB]))
    await db.delete(plans).where(inArray(plans.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  it('AiBriefing_DebitsExactlyOneCreditAndIsIdempotentPerPlan', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const plan = await svc.generatePlan(db, wsA, idA, input)
    const controller = controllerWith(
      new FakeLlm(true, 'Two focus blocks, one meeting — protect the morning.'),
    )

    const first = await controller.briefing(userA, { id: plan.id })
    expect(first.source).toBe('ai-proposal')
    expect(first.charged).toBe(true)
    expect(first.text).toContain('protect the morning')
    expect(await balanceFor(db, wsA)).toBe(4)

    // Re-briefing the same plan replays the same operationId → never double-charges.
    const again = await controller.briefing(userA, { id: plan.id })
    expect(again.source).toBe('ai-proposal')
    expect(await balanceFor(db, wsA)).toBe(4)
  })

  it('AiBriefing_ProviderDown_DegradesToDeterministicAndDoesNotCharge', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const plan = await svc.generatePlan(db, wsA, idA, input)
    const controller = controllerWith(new FakeLlm(false, 'unused'))

    const res = await controller.briefing(userA, { id: plan.id })

    expect(res.source).toBe('deterministic')
    expect(res.charged).toBe(false)
    expect(res.text).toContain('focus planned') // the factual fallback summary
    expect(await balanceFor(db, wsA)).toBe(5) // nothing debited
  })

  it('AiBriefing_ZeroBalance_GetsNoAiAndNoCharge', async () => {
    // No credits granted — the balance gate must keep the AI path closed even
    // though the provider is "up", and produce the deterministic briefing for free.
    const plan = await svc.generatePlan(db, wsA, idA, input)
    const controller = controllerWith(new FakeLlm(true, 'should not be used'))

    const res = await controller.briefing(userA, { id: plan.id })

    expect(res.source).toBe('deterministic')
    expect(res.charged).toBe(false)
    expect(await balanceFor(db, wsA)).toBe(0)
  })

  it('AiBriefing_MeteringIsWorkspaceIsolated', async () => {
    await grant(db, wsA, { amount: 5, category: 'monthly-grant' })
    const plan = await svc.generatePlan(db, wsA, idA, input)
    const controller = controllerWith(new FakeLlm(true, 'A grounded briefing.'))

    await controller.briefing(userA, { id: plan.id })

    // The debit landed on A's ledger only; B is untouched.
    expect(await balanceFor(db, wsA)).toBe(4)
    expect(await balanceFor(db, wsB)).toBe(0)
  })

  it('Briefing_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/planner/plans/00000000-0000-0000-0000-000000000000/briefing',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
