import { describe, expect, it } from 'vitest'
import {
  generatePlan,
  getPlan,
  getPlanBriefing,
  getPlanReview,
  parseBlock,
  parsePlan,
  parsePlanBriefing,
} from './planner.js'

/**
 * The planner client parses the versioned plan entity (proposed ghost blocks the
 * deterministic core placed) and posts a day frame to (re)generate it. These pin
 * the DTO parse (including the null "no plan yet" case) and the request paths.
 */
const PLAN = {
  id: 'p1',
  planDate: '2026-07-10',
  version: 2,
  status: 'proposed',
  plannedFocusMin: 180,
  unplacedMin: 60,
  droppedAnchors: [{ startMin: 540, lenMin: 30, label: 'Clash' }],
  blocks: [
    { startMin: 540, lenMin: 30, kind: 'meeting', label: 'Daily', taskId: null },
    { startMin: 570, lenMin: 90, kind: 'focus', label: 'Sync engine', taskId: 't1' },
  ],
}

const jsonFetch = (body: unknown, seen: string[]): typeof fetch =>
  ((url: string) => {
    seen.push(url)
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  }) as unknown as typeof fetch

describe('parseBlock / parsePlan', () => {
  it('ReadsAPlanWithItsBlocks', () => {
    const plan = parsePlan(PLAN)
    expect(plan?.version).toBe(2)
    expect(plan?.blocks[1]?.taskId).toBe('t1')
  })
  it('NullWhenNoPlanExists', () => {
    expect(parsePlan(null)).toBeNull()
  })
  it('FallsBackToFocusForAnUnknownKind', () => {
    expect(parseBlock({ startMin: 0, lenMin: 30, kind: 'wat', label: 'x' }).kind).toBe('focus')
  })
})

describe('requests', () => {
  it('GetsThePlanByDate', async () => {
    const seen: string[] = []
    const plan = await getPlan('http://api', '2026-07-10', jsonFetch(PLAN, seen))
    expect(plan?.id).toBe('p1')
    expect(seen[0]).toContain('/api/planner/plans?date=2026-07-10')
  })
  it('PostsToGenerateAPlan', async () => {
    const seen: string[] = []
    const plan = await generatePlan(
      'http://api',
      { date: '2026-07-10', dayStartMin: 480, dayEndMin: 1080, anchors: [], backlog: [] },
      jsonFetch(PLAN, seen),
    )
    expect(plan.version).toBe(2)
    expect(seen[0]).toContain('/api/planner/plans')
  })

  it('ReadsTheEveningReviewFromThePlanReviewRoute', async () => {
    const seen: string[] = []
    const review = await getPlanReview(
      'http://api',
      'p1',
      jsonFetch({ plannedFocusMin: 180, trackedFocusMin: 135, driftMin: -45 }, seen),
    )
    expect(review).toEqual({ plannedFocusMin: 180, trackedFocusMin: 135, driftMin: -45 })
    expect(seen[0]).toContain('/api/planner/plans/p1/review')
  })

  it('PostsForTheAiBriefingAndParsesTheResult', async () => {
    const seen: string[] = []
    const briefing = await getPlanBriefing(
      'http://api',
      'p1',
      jsonFetch({ source: 'ai-proposal', charged: true, text: 'Dichter Tag.' }, seen),
    )
    expect(briefing).toEqual({ source: 'ai-proposal', charged: true, text: 'Dichter Tag.' })
    expect(seen[0]).toContain('/api/planner/plans/p1/briefing')
  })
})

describe('parsePlanBriefing', () => {
  it('DefaultsToDeterministicForAnUnknownSource', () => {
    expect(parsePlanBriefing({ source: 'weird', charged: false, text: 'x' }).source).toBe(
      'deterministic',
    )
  })
})
