import { describe, expect, it } from 'vitest'
import { createRate, deleteRate, eurosToMinor, fetchRates, parseRate } from './rates.js'

/**
 * The rates client reads/writes the effective-dated, scoped rate rules the billing
 * module owns (REQ-005). These pin the DTO parse, the request paths + verbs, the
 * create body, and the pure euros→minor-units input parse (de/en decimal marks).
 */
const RATE = {
  id: 'r1',
  level: 'project',
  scopeId: '2f1c9a4e-0000-4000-8000-000000000000',
  amountMinorPerHour: 7800,
  effectiveFrom: '2026-07-14T00:00:00.000Z',
}

interface Seen {
  url: string
  method: string
  body: unknown
}
const spyFetch = (body: unknown, seen: Seen[]): typeof fetch =>
  ((url: string, init?: RequestInit) => {
    seen.push({
      url,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    })
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  }) as unknown as typeof fetch

describe('parseRate', () => {
  it('ReadsAScopedRateRule', () => {
    const r = parseRate(RATE)
    expect(r.level).toBe('project')
    expect(r.scopeId).toBe('2f1c9a4e-0000-4000-8000-000000000000')
    expect(r.amountMinorPerHour).toBe(7800)
  })
  it('DefaultsWorkspaceForAnUnknownLevelAndNullScope', () => {
    const r = parseRate({ ...RATE, level: 'nonsense', scopeId: null })
    expect(r.level).toBe('workspace')
    expect(r.scopeId).toBeNull()
  })
})

describe('requests', () => {
  it('ListsRatesFromTheBillingEndpoint', async () => {
    const seen: Seen[] = []
    const rates = await fetchRates('http://api', spyFetch([RATE], seen))
    expect(rates[0]?.id).toBe('r1')
    expect(seen[0]?.url).toContain('/api/billing/rates')
    expect(seen[0]?.method).toBe('GET')
  })
  it('CreatesARateWithTheTypedBody', async () => {
    const seen: Seen[] = []
    await createRate(
      'http://api',
      {
        level: 'client',
        scopeId: 'c1',
        amountMinorPerHour: 9000,
        effectiveFrom: '2026-07-14T00:00:00.000Z',
      },
      spyFetch(RATE, seen),
    )
    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.url).toContain('/api/billing/rates')
    expect(seen[0]?.body).toMatchObject({
      level: 'client',
      scopeId: 'c1',
      amountMinorPerHour: 9000,
    })
  })
  it('DeletesARateById', async () => {
    const seen: Seen[] = []
    await deleteRate('http://api', 'r1', spyFetch({}, seen))
    expect(seen[0]?.method).toBe('DELETE')
    expect(seen[0]?.url).toContain('/api/billing/rates/r1')
  })
})

describe('eurosToMinor', () => {
  it('ParsesWholeAndDecimalAmounts', () => {
    expect(eurosToMinor('78')).toBe(7800)
    expect(eurosToMinor('78.50')).toBe(7850)
    expect(eurosToMinor('78,50')).toBe(7850) // German comma
    expect(eurosToMinor('0')).toBe(0)
    expect(eurosToMinor('9,5')).toBe(950)
  })
  it('ReadsAThousandsGroupNotCents', () => {
    expect(eurosToMinor('1.234')).toBe(123400) // 1234,00 — not 12,34
    expect(eurosToMinor('1.234,50')).toBe(123450)
  })
  it('RejectsGarbageAndNegatives', () => {
    expect(eurosToMinor('')).toBeNull()
    expect(eurosToMinor('abc')).toBeNull()
    expect(eurosToMinor('-5')).toBeNull()
    expect(eurosToMinor('1.2.3,45')).toBe(12345) // groups collapse; last sep is decimal
    expect(eurosToMinor('5.123456')).toBeNull() // too many decimals
  })
})
