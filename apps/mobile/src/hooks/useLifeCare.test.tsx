// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { TestQueryProvider } from '../test/TestQueryProvider.js'
import { HEAVY_LOAD_SCORE } from '@mydevtime/domain'

/**
 * `useLifeCare` (ADR-0071 P5, REQ-071): the derivation from real feeds — week occurrences →
 * `freeEveningsIn` + encroachment, load history → `computeBaseline` heavy-run — and, crucially,
 * that EVERY life-care voice runs through the SAME `decideNudge` gate as the real-time watch
 * (opt-in, quiet hours, 🛡 now, the shared daily budget). A gated-out suggestion is not
 * rendered; a held one only flags `digestPending`.
 */

vi.mock('../config', () => ({ apiBaseUrl: 'https://api.test' }))

const prefsState = {
  seviProactive: true,
  quietStartMin: 1320,
  quietEndMin: 420,
}
vi.mock('./usePreferences.js', () => ({
  usePreferences: () => ({
    prefs: prefsState,
    live: true,
    loading: false,
    error: null,
    setPref: () => undefined,
    setNumberPref: () => undefined,
  }),
}))

const listOccurrences = vi.fn()
vi.mock('../api/recurrence.js', () => ({
  listOccurrences: (...args: unknown[]) => listOccurrences(...args) as unknown,
}))

const getLoadHistory = vi.fn()
vi.mock('../api/loadHistory.js', () => ({
  getLoadHistory: (...args: unknown[]) => getLoadHistory(...args) as unknown,
}))

const getProtectedTimes = vi.fn()
vi.mock('../api/planApply.js', () => ({
  getProtectedTimes: (...args: unknown[]) => getProtectedTimes(...args) as unknown,
  applyPlanProposal: vi.fn(),
}))

// Imported after the mocks so the hook picks up the mocked config + feeds.
const { useLifeCare } = await import('./useLifeCare.js')
const { resetNudgeBudget, recordNudge, nudgesSentToday, SEVI_DAILY_CAP } =
  await import('../sevi/nudgeBudget.js')
type LifeCareState = ReturnType<typeof useLifeCare>

// Wednesday 2026-07-15, 10:00 local — inside the week below, outside the default quiet hours.
const NOW = new Date(2026, 6, 15, 10, 0, 0)
const WEEK = [
  '2026-07-13',
  '2026-07-14',
  '2026-07-15',
  '2026-07-16',
  '2026-07-17',
  '2026-07-18',
  '2026-07-19',
]

/** A focus (work) occurrence 18:00–21:00 on `date` — one booked evening. */
function eveningWork(date: string): Record<string, unknown> {
  return {
    seriesId: `work-${date}`,
    kind: 'focus',
    title: 'Late focus',
    date,
    startMin: 18 * 60,
    lenMin: 180,
    projectId: null,
    priority: null,
    note: null,
  }
}

/** Six heavy days in a row — a `consecutive-heavy-days` run for the baseline core. */
const HEAVY_HISTORY = Array.from({ length: 6 }, (_, i) => ({
  loadScore: HEAVY_LOAD_SCORE + 1,
  weekday: (i + 1) % 7,
}))

const result: { state: LifeCareState | null } = { state: null }

function Probe(): null {
  result.state = useLifeCare(WEEK)
  return null
}

async function renderProbe(): Promise<void> {
  await act(async () => {
    TestRenderer.create(
      <TestQueryProvider>
        <Probe />
      </TestQueryProvider>,
    )
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetNudgeBudget()
  result.state = null
  prefsState.seviProactive = true
  listOccurrences.mockResolvedValue(WEEK.map(eveningWork))
  getLoadHistory.mockResolvedValue([])
  getProtectedTimes.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('useLifeCare', () => {
  it('LifeCare_EveryEveningBooked_SurfacesTheProtectEveningVoice', async () => {
    await renderProbe()
    const kinds = result.state?.suggestions.map(s => s.kind)
    expect(kinds).toEqual(['no-free-evening'])
    // Deterministic pick: all evenings equally booked → the earliest not-yet-past day (today).
    expect(result.state?.suggestions[0]?.proposal).toEqual({
      kind: 'protect-time',
      day: '2026-07-15',
      startMin: 18 * 60,
      endMin: 22 * 60,
    })
  })

  it('LifeCare_SurfacingOnce_DrawsExactlyOneVoiceFromTheSharedBudget', async () => {
    await renderProbe()
    expect(result.state?.suggestions.length).toBeGreaterThan(0)
    expect(nudgesSentToday(Date.now())).toBe(1)
  })

  it('LifeCare_WorkOverlappingALifeBlock_OrdersEncroachmentFirst', async () => {
    listOccurrences.mockResolvedValue([
      ...WEEK.map(eveningWork),
      {
        seriesId: 'life-yoga',
        kind: 'life',
        title: 'Yoga',
        date: '2026-07-16',
        startMin: 19 * 60,
        lenMin: 60,
        projectId: null,
        priority: null,
        note: null,
      },
    ])
    await renderProbe()
    expect(result.state?.suggestions.map(s => s.kind)).toEqual([
      'life-encroachment',
      'no-free-evening',
    ])
    // The confirm protects the encroached life block's own window.
    expect(result.state?.suggestions[0]?.proposal).toEqual({
      kind: 'protect-time',
      day: '2026-07-16',
      startMin: 19 * 60,
      endMin: 20 * 60,
    })
    expect(result.state?.suggestions[0]?.message).toContain('Yoga')
  })

  it('LifeCare_HeavyRunInTheLoadHistory_ProposesARestDayForTomorrowEvening', async () => {
    listOccurrences.mockResolvedValue([])
    getLoadHistory.mockResolvedValue(HEAVY_HISTORY)
    await renderProbe()
    expect(result.state?.suggestions.map(s => s.kind)).toEqual(['rest-day'])
    expect(result.state?.suggestions[0]?.proposal).toEqual({
      kind: 'protect-time',
      day: '2026-07-16',
      startMin: 18 * 60,
      endMin: 22 * 60,
    })
  })

  it('LifeCare_OptedOut_DeliversNothingAndHoldsNoDigest', async () => {
    prefsState.seviProactive = false
    await renderProbe()
    expect(result.state?.suggestions).toEqual([])
    expect(result.state?.digestPending).toBe(false)
    expect(nudgesSentToday(Date.now())).toBe(0)
  })

  it('LifeCare_InsideAProtectedBlockNow_HoldsTheVoicesForADigest', async () => {
    getProtectedTimes.mockResolvedValue([
      { id: 'prot-1', day: '2026-07-15', startMin: 0, endMin: 1440, source: 'sevi' },
    ])
    await renderProbe()
    expect(result.state?.suggestions).toEqual([])
    expect(result.state?.digestPending).toBe(true)
    expect(nudgesSentToday(Date.now())).toBe(0)
  })

  it('LifeCare_SharedDailyBudgetSpent_StaysSilent', async () => {
    for (let i = 0; i < SEVI_DAILY_CAP; i++) recordNudge(Date.now())
    await renderProbe()
    expect(result.state?.suggestions).toEqual([])
    expect(result.state?.digestPending).toBe(false)
  })

  it('LifeCare_QuietWeekAndNoHistory_IsSilent', async () => {
    listOccurrences.mockResolvedValue([])
    await renderProbe()
    expect(result.state?.suggestions).toEqual([])
    expect(result.state?.digestPending).toBe(false)
    expect(nudgesSentToday(Date.now())).toBe(0)
  })

  it('LifeCare_FeedStillLoadingOrFailed_NeverGuesses', async () => {
    listOccurrences.mockRejectedValue(new Error('down'))
    getLoadHistory.mockResolvedValue(HEAVY_HISTORY)
    await renderProbe()
    // The occurrence feed failed → no evening/encroachment judgement; the independent
    // history feed still carries the rest-day signal honestly.
    expect(result.state?.suggestions.map(s => s.kind)).toEqual(['rest-day'])
  })
})
