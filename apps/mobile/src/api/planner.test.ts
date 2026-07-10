import { describe, expect, it } from 'vitest'
import { generatePlan, getPlan, parseBlock, parsePlan } from './planner.js'

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
})
