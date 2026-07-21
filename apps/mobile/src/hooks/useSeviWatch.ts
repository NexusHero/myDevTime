import { useEffect, useRef, useState } from 'react'
import { decideNudge, type LiveLoad, type NudgeDecision } from '@mydevtime/domain'
import { apiBaseUrl } from '../config.js'
import { getProtectedTimes, type ProtectedTime } from '../api/planApply.js'
import { createNotificationPort } from '../notifications/port.js'
import { nudgesSentToday, recordNudge, SEVI_DAILY_CAP } from '../sevi/nudgeBudget.js'
import { pick } from '../i18n/strings.js'
import { useLiveLoad } from './useLiveLoad.js'
import { usePreferences } from './usePreferences.js'

/**
 * Sevi's real-time overwork watch (ADR-0071 P2, REQ-067/069): composes the
 * deterministic live-load resource with the person's preferences, the day's 🛡
 * protected windows and the shared daily nudge budget, then lets the pure
 * `decideNudge` policy say whether *now* is the moment to speak. WHETHER Sevi
 * speaks is 100 % the domain core's call (ADR-0005) — this hook only wires real
 * state into it and carries the two side effects a delivery has: ONE local
 * notification per escalation (guarded against re-fires across ticks) and one
 * `recordNudge` against the shared budget. A speak-up held by quiet hours or a
 * protected block surfaces as `digestPending` and later resolves into a single
 * calm line (REQ-057 "hold nudges, one digest after") — inline only, no ping.
 * All copy is bilingual via the `pick(en, de)` seam.
 */
export interface SeviWatchResource {
  /** Whether the inline watch line should render on Today. */
  readonly visible: boolean
  /** The line to show (a live nudge or the one later digest), or `null` when hidden. */
  readonly message: string | null
  /** A real speak-up is being held (quiet hours / protection) for one later digest. */
  readonly digestPending: boolean
}

/** Re-evaluation cadence, mirroring `useTrackReminder` / `useLiveLoad` (cheap, no network). */
const TICK_MS = 30_000

/** The device-local calendar day key (same convention as the shared nudge budget). */
function localDayKey(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1)}-${String(d.getDate())}`
}

/** The device-local `YYYY-MM-DD` — the day the planner's protected windows are keyed by. */
function localDateISO(ms: number): string {
  const d = new Date(ms)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${String(d.getFullYear())}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** The device-local minute of day (0..1439) — the quiet-hours axis. */
function localMinuteOfDay(ms: number): number {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * The live nudge line for a delivered speak-up: the accessible name carries the
 * *reason*, phrased the way a caring colleague would — never an alarm, never a
 * diagnosis. Keyed off the first (loudest, stable-ordered) domain reason.
 */
function liveMessage(load: LiveLoad): string {
  switch (load.reasons[0]) {
    case 'long-day':
      return pick('A long day — wrapping up soon?', 'Ein langer Tag — bald Feierabend?')
    case 'no-break':
      return pick(
        'A long stretch without a break — time to breathe?',
        'Lange ohne Pause — kurz durchatmen?',
      )
    case 'meeting-marathon':
      return pick(
        'Meetings back to back — a pause between them?',
        'Meetings am Stück — kurz Luft holen dazwischen?',
      )
    case 'consecutive-heavy':
      return pick(
        'Several heavy days in a row — take it easier today.',
        'Mehrere schwere Tage in Folge — heute etwas ruhiger.',
      )
    default:
      // 'overtime-today' / 'above-baseline' / (defensively) an empty list.
      return pick(
        'Today is running heavier than your usual — take care.',
        'Heute läuft schwerer als sonst bei dir — pass auf dich auf.',
      )
  }
}

/** The one later calm line a held speak-up folds into (REQ-057) — never a queue of pings. */
function digestMessage(): string {
  return pick(
    'While you were heads-down, it got long — be kind to yourself this evening.',
    'Während du im Fokus warst, wurde es lang — sei heute Abend nachsichtig mit dir.',
  )
}

export function useSeviWatch(): SeviWatchResource {
  const { load, loading } = useLiveLoad()
  const { prefs } = usePreferences()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [protectedTimes, setProtectedTimes] = useState<readonly ProtectedTime[]>([])
  // Delivery waits until the protection answer is in: firing a ping during the fetch
  // window could break straight into a 🛡 block — the exact thing REQ-070 forbids.
  const [protectionPending, setProtectionPending] = useState(apiBaseUrl !== null)
  const [heldDigest, setHeldDigest] = useState(false)
  const [digestLine, setDigestLine] = useState<string | null>(null)
  // The escalation already notified (day + level + reasons): one ping per escalation,
  // never one per tick.
  const notifiedRef = useRef<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now())
    }, TICK_MS)
    return () => {
      clearInterval(id)
    }
  }, [])

  // Today's 🛡 protected windows (REQ-070). Unreachable ⇒ treated as none — the
  // opt-in, quiet-hours and cap gates still stand, and the app never invents a shield.
  useEffect(() => {
    let alive = true
    if (apiBaseUrl === null) return
    getProtectedTimes(apiBaseUrl, localDateISO(Date.now()))
      .then(windows => {
        if (alive) setProtectedTimes(windows)
      })
      .catch(() => {
        /* honest degradation: no windows */
      })
      .finally(() => {
        if (alive) setProtectionPending(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const minute = localMinuteOfDay(nowMs)
  const today = localDateISO(nowMs)
  const inProtectedBlock = protectedTimes.some(
    w => w.day === today && minute >= w.startMin && minute < w.endMin,
  )

  // While the worktime feed or the baseline history is still loading the watch never
  // fires — a missing signal is silence, not a verdict (H3 honesty).
  const decision: NudgeDecision | null =
    loading || protectionPending
      ? null
      : decideNudge({
          now: nowMs,
          minuteOfDay: minute,
          load,
          proactiveOptIn: prefs.seviProactive,
          quietStartMin: prefs.quietStartMin,
          quietEndMin: prefs.quietEndMin,
          inProtectedBlock,
          nudgesSentToday: nudgesSentToday(nowMs),
          dailyCap: SEVI_DAILY_CAP,
        })

  const deliver = decision?.deliver === true
  const signature = deliver ? `${localDayKey(nowMs)}|${load.level}|${load.reasons.join('+')}` : null
  const message = deliver ? liveMessage(load) : null

  // Side effects of a delivery, once per escalation: count the voice against the
  // shared budget and fire ONE local notification (the port degrades to a no-op
  // without a channel — the inline line above is always the primary surface).
  useEffect(() => {
    if (signature === null || message === null) return
    if (notifiedRef.current === signature) return
    notifiedRef.current = signature
    recordNudge(Date.now())
    setHeldDigest(false)
    void createNotificationPort().notify({ title: 'Sevi', body: message })
  }, [signature, message])

  // Hold a suppressed-but-real speak-up (digest: quiet hours / protection); when the
  // suppressor is gone it folds into ONE calm inline line — no notification, no queue.
  const holdNow = decision !== null && !decision.deliver && decision.digest
  const releasable =
    decision !== null && !decision.deliver && !decision.digest && decision.reason !== 'opt-out'
  useEffect(() => {
    if (holdNow) {
      setHeldDigest(true)
      return
    }
    if (heldDigest && releasable) {
      setHeldDigest(false)
      setDigestLine(digestMessage())
    }
  }, [holdNow, releasable, heldDigest])

  if (deliver && message !== null) return { visible: true, message, digestPending: false }
  if (digestLine !== null) return { visible: true, message: digestLine, digestPending: false }
  return { visible: false, message: null, digestPending: heldDigest }
}
