import { describe, expect, it } from 'vitest'
import { fetchBalance, fetchLedger, fetchUsage, parseEntry, prettyCategory } from './credits.js'

/**
 * The credits client reads the balance, the append-only ledger, and the usage
 * breakdown the billing credit service derives. These pin the DTO parse, the
 * request paths, and the category label helper.
 */
const ENTRY = {
  id: 'l1',
  kind: 'debit',
  amount: -8,
  category: 'meeting-insights',
  reason: 'Finanzo review',
  createdAt: '2026-07-07T10:00:00.000Z',
}
const jsonFetch = (body: unknown, seen: string[]): typeof fetch =>
  ((url: string) => {
    seen.push(url)
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  }) as unknown as typeof fetch

describe('parseEntry', () => {
  it('ReadsASignedLedgerEntry', () => {
    const e = parseEntry(ENTRY)
    expect(e.amount).toBe(-8)
    expect(e.at).toBe('2026-07-07T10:00:00.000Z')
    expect(e.reason).toBe('Finanzo review')
  })
})

describe('prettyCategory', () => {
  it('MapsKnownSlugsAndTitleCasesTheRest', () => {
    expect(prettyCategory('meeting-insights')).toBe('Meeting insights')
    expect(prettyCategory('some-new-thing')).toBe('Some New Thing')
  })
})

describe('requests', () => {
  it('GetsTheBalance', async () => {
    const seen: string[] = []
    expect(await fetchBalance('http://api', jsonFetch({ balance: 485 }, seen))).toBe(485)
    expect(seen[0]).toContain('/api/billing/credits')
  })
  it('GetsTheLedgerWithLimit', async () => {
    const seen: string[] = []
    const ledger = await fetchLedger('http://api', 25, jsonFetch([ENTRY], seen))
    expect(ledger[0]?.id).toBe('l1')
    expect(seen[0]).toContain('/api/billing/credits/ledger?limit=25')
  })
  it('GetsUsageWithWindow', async () => {
    const seen: string[] = []
    const usage = await fetchUsage(
      'http://api',
      { from: '2026-07-01T00:00:00.000Z', to: '2026-08-01T00:00:00.000Z' },
      jsonFetch([{ category: 'meeting-insights', credits: 11 }], seen),
    )
    expect(usage[0]?.credits).toBe(11)
    expect(seen[0]).toContain('/api/billing/credits/usage?')
  })
})
