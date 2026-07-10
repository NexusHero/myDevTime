import { describe, expect, it } from 'vitest'
import {
  fetchBudgetStatus,
  fetchBudgets,
  parseBudget,
  parseBudgetStatus,
  toBudgetRings,
} from './budgets.js'

/**
 * The budgets client reads the `billing` module's budget list and per-budget
 * status (consumed / limit / ratio, computed by the deterministic core) and
 * joins them into ring rows for the Reports screen. These pin the DTO parse, the
 * request paths, and the name-join (project scope only, id fallback, money vs
 * hours basis carried through).
 */
const BUDGET = {
  id: 'b1',
  scope: 'project',
  scopeId: 'p1',
  basis: 'money',
  limitAmount: 500_000,
  period: 'total',
}
const STATUS = {
  budget: BUDGET,
  status: { consumed: 325_000, limit: 500_000, ratio: 0.65, remaining: 175_000, reached: [] },
  currencyCode: 'EUR',
}

describe('parseBudget', () => {
  it('ReadsScopeBasisAndLimit', () => {
    const b = parseBudget(BUDGET)
    expect(b).toEqual({
      id: 'b1',
      scope: 'project',
      scopeId: 'p1',
      basis: 'money',
      limitAmount: 500_000,
      period: 'total',
    })
  })
  it('MalformedPayload_Throws', () => {
    expect(() => parseBudget({ id: 1 })).toThrow()
  })
})

describe('parseBudgetStatus', () => {
  it('ReadsConsumedRatioAndCurrency', () => {
    const s = parseBudgetStatus(STATUS)
    expect(s.status.ratio).toBe(0.65)
    expect(s.status.consumed).toBe(325_000)
    expect(s.currencyCode).toBe('EUR')
    expect(s.budget.scopeId).toBe('p1')
  })
})

describe('fetchBudgets / fetchBudgetStatus', () => {
  it('GetsListThenStatusByPath', async () => {
    const seen: string[] = []
    const list = ((url: string) => {
      seen.push(url)
      return Promise.resolve(new Response(JSON.stringify([BUDGET]), { status: 200 }))
    }) as unknown as typeof fetch
    const status = ((url: string) => {
      seen.push(url)
      return Promise.resolve(new Response(JSON.stringify(STATUS), { status: 200 }))
    }) as unknown as typeof fetch

    const budgets = await fetchBudgets('http://api', list)
    expect(budgets[0]?.id).toBe('b1')
    const st = await fetchBudgetStatus('http://api', 'b1', status)
    expect(st.status.ratio).toBe(0.65)

    expect(seen[0]).toContain('/api/billing/budgets')
    expect(seen[1]).toContain('/api/billing/budgets/b1/status')
  })
})

describe('toBudgetRings', () => {
  const money = STATUS
  const hours = {
    budget: {
      id: 'b2',
      scope: 'project',
      scopeId: 'p2',
      basis: 'hours',
      limitAmount: 3_600_000,
      period: 'total',
    },
    status: {
      consumed: 1_800_000,
      limit: 3_600_000,
      ratio: 0.5,
      remaining: 1_800_000,
      reached: [],
    },
    currencyCode: 'EUR',
  }
  it('JoinsNamesAndCarriesBasis', () => {
    const rings = toBudgetRings([money, hours], new Map([['p1', 'Finanzo']]))
    expect(rings[0]).toEqual({
      id: 'b1',
      name: 'Finanzo',
      ratio: 0.65,
      consumed: 325_000,
      basis: 'money',
      currencyCode: 'EUR',
    })
    expect(rings[1]?.basis).toBe('hours')
  })
  it('UnknownProject_FallsBackToScopeId', () => {
    const rings = toBudgetRings([money], new Map())
    expect(rings[0]?.name).toBe('p1')
  })
  it('DropsNonProjectScopes', () => {
    const client = { ...money, budget: { ...BUDGET, id: 'b3', scope: 'client' } }
    const rings = toBudgetRings([client], new Map())
    expect(rings).toEqual([])
  })
})
