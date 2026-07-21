// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import type { LiveLoad } from '@mydevtime/domain'

/**
 * Unit tests (ADR-0027) for `useSeviWatch` — the composition of the deterministic
 * live-load + nudge-policy cores with the client's preferences, the day's 🛡
 * protected windows and the shared daily nudge budget (ADR-0071 P2, REQ-069).
 * The seams around it are mocked as mutable fixtures so a single render tree can
 * walk the hook through real transitions (tick → re-evaluate). Pinned here:
 * delivery is inline + ONE notification per escalation (never a re-fire on the
 * next tick), opt-out and calm stay silent, quiet hours / protection hold a
 * digest, and a held digest resolves into a single later calm line.
 */

// ─── Mutable seam fixtures ────────────────────────────────────────────────────────────────
const seams = vi.hoisted(() => {
  const notify = vi.fn(() => Promise.resolve())
  return {
    load: { level: 'calm', reasons: [], hardCapHit: false } as {
      level: 'calm' | 'watch' | 'speak-up'
      reasons: string[]
      hardCapHit: boolean
    },
    loading: false,
    prefs: {
      seviProactive: true,
      moodConsent: false,
      quietStartMin: 0,
      quietEndMin: 0, // start === end ⇒ no quiet window
    },
    protectedTimes: [] as {
      id: string
      day: string
      startMin: number
      endMin: number
      source: string
    }[],
    // When true the mock answers EVERY queried day with a full-day 🛡 window — the shape a
    // server that protects "around midnight" serves; lets the tests pin the day-keyed refetch.
    protectAllDay: false,
    notify,
  }
})

vi.mock('./useLiveLoad.js', () => ({
  useLiveLoad: () => ({ load: seams.load as unknown as LiveLoad, loading: seams.loading }),
}))
vi.mock('./usePreferences.js', () => ({
  usePreferences: () => ({
    prefs: seams.prefs,
    live: true,
    loading: false,
    error: null,
    setPref: vi.fn(),
    setNumberPref: vi.fn(),
  }),
}))
vi.mock('../config.js', () => ({ apiBaseUrl: 'https://api.test' }))
vi.mock('../api/planApply.js', () => ({
  getProtectedTimes: (_base: string, day: string) =>
    Promise.resolve(
      seams.protectAllDay
        ? [{ id: 'shield', day, startMin: 0, endMin: 1440, source: 'sevi' }]
        : seams.protectedTimes,
    ),
}))
vi.mock('../notifications/port.js', () => ({
  createNotificationPort: () => ({
    available: true,
    requestPermission: () => Promise.resolve(true),
    notify: seams.notify,
  }),
}))

const { useSeviWatch } = await import('./useSeviWatch.js')
const { resetNudgeBudget, nudgesSentToday } = await import('../sevi/nudgeBudget.js')

type Resource = ReturnType<typeof useSeviWatch>

let latest: Resource
function Probe(): null {
  latest = useSeviWatch()
  return null
}

async function renderProbe(): Promise<TestRenderer.ReactTestRenderer> {
  let r!: TestRenderer.ReactTestRenderer
  await act(async () => {
    r = TestRenderer.create(<Probe />)
    await Promise.resolve()
  })
  return r
}

/** Advance one 30 s tick so the hook re-evaluates (its interval pattern). */
async function tick(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(30_000)
    await Promise.resolve()
  })
}

/** The device-local minute of day right now. */
function minuteNow(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/** The device-local YYYY-MM-DD of today (what the hook queries protection for). */
function todayISO(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${String(d.getFullYear())}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const SPEAK_UP: typeof seams.load = {
  level: 'speak-up',
  reasons: ['long-day'],
  hardCapHit: true,
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  resetNudgeBudget()
  seams.load = { level: 'calm', reasons: [], hardCapHit: false }
  seams.loading = false
  seams.prefs = { seviProactive: true, moodConsent: false, quietStartMin: 0, quietEndMin: 0 }
  seams.protectedTimes = []
  seams.protectAllDay = false
  seams.notify.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSeviWatch', () => {
  it('Calm_StaysInvisible_NoNotification', async () => {
    const r = await renderProbe()
    expect(latest.visible).toBe(false)
    expect(latest.message).toBeNull()
    expect(latest.digestPending).toBe(false)
    expect(seams.notify).not.toHaveBeenCalled()
    r.unmount()
  })

  it('SpeakUp_OptedIn_DeliversInline_AndNotifiesOncePerEscalation', async () => {
    seams.load = { ...SPEAK_UP }
    const r = await renderProbe()
    expect(latest.visible).toBe(true)
    expect(latest.message).toMatch(/long day/i)
    expect(seams.notify).toHaveBeenCalledTimes(1)
    expect(nudgesSentToday(Date.now())).toBe(1)

    // The next tick re-evaluates the same escalation — no re-fire, budget unchanged.
    await tick()
    expect(latest.visible).toBe(true)
    expect(seams.notify).toHaveBeenCalledTimes(1)
    expect(nudgesSentToday(Date.now())).toBe(1)
    r.unmount()
  })

  it('SpeakUp_OptedOut_StaysFullySilent', async () => {
    seams.load = { ...SPEAK_UP }
    seams.prefs.seviProactive = false
    const r = await renderProbe()
    expect(latest.visible).toBe(false)
    expect(latest.digestPending).toBe(false)
    expect(seams.notify).not.toHaveBeenCalled()
    r.unmount()
  })

  it('SpeakUp_InQuietHours_HoldsForOneDigest', async () => {
    seams.load = { ...SPEAK_UP }
    // A quiet window wrapped around the current minute.
    seams.prefs.quietStartMin = (minuteNow() + 1430) % 1440
    seams.prefs.quietEndMin = (minuteNow() + 10) % 1440
    const r = await renderProbe()
    expect(latest.visible).toBe(false)
    expect(latest.digestPending).toBe(true)
    expect(seams.notify).not.toHaveBeenCalled()
    r.unmount()
  })

  it('SpeakUp_InProtectedBlock_HoldsForOneDigest', async () => {
    seams.load = { ...SPEAK_UP }
    seams.protectedTimes = [
      {
        id: 'pt1',
        day: todayISO(),
        startMin: Math.max(0, minuteNow() - 30),
        endMin: Math.min(1440, minuteNow() + 30),
        source: 'sevi',
      },
    ]
    const r = await renderProbe()
    expect(latest.visible).toBe(false)
    expect(latest.digestPending).toBe(true)
    expect(seams.notify).not.toHaveBeenCalled()
    r.unmount()
  })

  it('HeldDigest_SuppressorGoneAndLoadCalm_ShowsOneCalmLine_WithoutNotifying', async () => {
    seams.load = { ...SPEAK_UP }
    seams.prefs.quietStartMin = (minuteNow() + 1430) % 1440
    seams.prefs.quietEndMin = (minuteNow() + 10) % 1440
    const r = await renderProbe()
    expect(latest.digestPending).toBe(true)

    // Quiet hours end; the day has calmed down meanwhile — the held speak-up folds
    // into ONE calm line (REQ-057 "hold nudges, one digest after"), never a ping.
    seams.prefs.quietStartMin = 0
    seams.prefs.quietEndMin = 0
    seams.load = { level: 'calm', reasons: [], hardCapHit: false }
    await tick()
    expect(latest.visible).toBe(true)
    expect(latest.message).toMatch(/heads-down|long/i)
    expect(latest.digestPending).toBe(false)
    expect(seams.notify).not.toHaveBeenCalled()
    r.unmount()
  })

  it('WhileLoading_NeverFires', async () => {
    seams.load = { ...SPEAK_UP }
    seams.loading = true
    const r = await renderProbe()
    expect(latest.visible).toBe(false)
    expect(latest.digestPending).toBe(false)
    expect(seams.notify).not.toHaveBeenCalled()
    r.unmount()
  })

  it('ProtectedWindowConfirmedMidSession_SuppressesTheNextEvaluation', async () => {
    const r = await renderProbe()
    expect(latest.visible).toBe(false)
    // The user confirms a 🛡 window AFTER mount; the load escalates on the next tick. The
    // watch must have refetched the windows by then — a mount-time snapshot would deliver
    // a ping straight into the freshly protected block.
    seams.protectedTimes = [
      {
        id: 'pt-live',
        day: todayISO(),
        startMin: Math.max(0, minuteNow() - 30),
        endMin: Math.min(1440, minuteNow() + 30),
        source: 'sevi',
      },
    ]
    seams.load = { ...SPEAK_UP }
    await tick()
    expect(latest.visible).toBe(false)
    expect(latest.digestPending).toBe(true)
    expect(seams.notify).not.toHaveBeenCalled()
    r.unmount()
  })

  it('CrossingMidnight_KeepsTheNewDaysProtection', async () => {
    // 23:59:45 — every queried day is fully protected server-side (`protectAllDay`).
    vi.setSystemTime(new Date(2026, 6, 20, 23, 59, 45))
    seams.protectAllDay = true
    seams.load = { ...SPEAK_UP }
    const r = await renderProbe()
    expect(latest.visible).toBe(false)
    expect(latest.digestPending).toBe(true)

    // One tick later it is past midnight. The watch must query the NEW day's windows —
    // keeping only the mount-day rows would filter them all out and silently un-protect.
    await tick()
    expect(latest.visible).toBe(false)
    expect(latest.digestPending).toBe(true)
    expect(seams.notify).not.toHaveBeenCalled()
    r.unmount()
  })

  it('DailyCapSpent_NoFurtherDelivery', async () => {
    seams.load = { ...SPEAK_UP }
    // Spend the whole shared budget before the watch ever evaluates.
    const { recordNudge, SEVI_DAILY_CAP } = await import('../sevi/nudgeBudget.js')
    for (let i = 0; i < SEVI_DAILY_CAP; i += 1) recordNudge(Date.now())
    const r = await renderProbe()
    expect(latest.visible).toBe(false)
    expect(seams.notify).not.toHaveBeenCalled()
    r.unmount()
  })

  // ─── Day-scoped stretch acknowledgment wiring (ADR-0072 D1, REQ-072) ──────────────────────

  it('StretchAcknowledged_OwnBaselineSpeakUp_StaysQuiet_NoBudgetSpent', async () => {
    const { recordStretchAck, resetStretchAck } = await import('../sevi/stretchAck.js')
    try {
      recordStretchAck(Date.now())
      // An own-baseline speak-up (no universal cap crossed) — the accepted stretch was chosen.
      seams.load = { level: 'speak-up', reasons: ['above-baseline'], hardCapHit: false }
      const r = await renderProbe()
      expect(latest.visible).toBe(false)
      expect(latest.digestPending).toBe(false) // chosen ⇒ nothing to digest later either
      expect(seams.notify).not.toHaveBeenCalled()
      expect(nudgesSentToday(Date.now())).toBe(0)
      r.unmount()
    } finally {
      resetStretchAck()
    }
  })

  it('StretchAcknowledged_HardCapSpeakUp_StillDelivers', async () => {
    const { recordStretchAck, resetStretchAck } = await import('../sevi/stretchAck.js')
    try {
      recordStretchAck(Date.now())
      seams.load = { ...SPEAK_UP } // hardCapHit: true — the ArbZG caps stay inviolable
      const r = await renderProbe()
      expect(latest.visible).toBe(true)
      expect(seams.notify).toHaveBeenCalledTimes(1)
      r.unmount()
    } finally {
      resetStretchAck()
    }
  })
})
