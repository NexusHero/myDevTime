import { useEffect, useRef, useState } from 'react'
import { decideNudge, type LiveLoad, type NudgeDecision } from '@mydevtime/domain'
import { apiBaseUrl } from '../config.js'
import { getProtectedTimes, type ProtectedTime } from '../api/planApply.js'
import { createNotificationPort } from '../notifications/port.js'
import { nudgesSentToday, SEVI_DAILY_CAP, tryClaimNudge } from '../sevi/nudgeBudget.js'
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
 * ATOMIC `tryClaimNudge` against the shared budget — the claim, not a render-time
 * check, is what finally lets a voice out. A speak-up held by quiet hours or a
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
  // The last 🛡 answer and the tick instant it answered FOR. Delivery only ever claims on an
  // answer fetched for the CURRENT tick (see the claim effect): firing a ping off a stale
  // snapshot could break straight into a window confirmed a moment ago — the exact thing
  // REQ-070 forbids. Rendering still uses the last known windows, so an already-delivered
  // line never flickers while a tick's refetch is in flight.
  const [protection, setProtection] = useState<{
    readonly asOf: number
    readonly windows: readonly ProtectedTime[]
  } | null>(null)
  const [heldDigest, setHeldDigest] = useState(false)
  const [digestLine, setDigestLine] = useState<string | null>(null)
  // The escalation (day + level + reasons) whose atomic budget claim SUCCEEDED — only a
  // claimed escalation renders and stays rendered across ticks.
  const [claimedSig, setClaimedSig] = useState<string | null>(null)
  // The escalation that already attempted its claim: one claim (and at most one ping) per
  // escalation, never one per tick — and a LOST claim is not retried for the same escalation.
  const attemptedRef = useRef<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now())
    }, TICK_MS)
    return () => {
      clearInterval(id)
    }
  }, [])

  // Today's 🛡 protected windows (REQ-070), refetched on the SAME periodic tick the live-load
  // evaluation runs on — a mount-time snapshot would miss a window the user confirms later in
  // the session and deliver a ping straight into it. The queried day is derived from the
  // tick's own instant, so crossing midnight asks for the NEW day instead of filtering
  // yesterday's rows down to nothing (which would silently un-protect the night).
  useEffect(() => {
    let alive = true
    if (apiBaseUrl === null) return
    getProtectedTimes(apiBaseUrl, localDateISO(nowMs))
      .then(windows => {
        if (alive) setProtection({ asOf: nowMs, windows })
      })
      .catch(() => {
        // Honest degradation: keep the previous windows (never invent OR drop a shield on a
        // network blip) but mark the tick answered — the opt-in/quiet-hours/cap gates still run.
        if (alive) setProtection(p => ({ asOf: nowMs, windows: p?.windows ?? [] }))
      })
    return () => {
      alive = false
    }
  }, [nowMs])

  const protectedTimes = protection?.windows ?? []
  // Whether the protection answer is for THIS tick — the claim effect's freshness gate.
  const protectionFresh = apiBaseUrl === null || protection?.asOf === nowMs

  const minute = localMinuteOfDay(nowMs)
  const today = localDateISO(nowMs)
  const inProtectedBlock = protectedTimes.some(
    w => w.day === today && minute >= w.startMin && minute < w.endMin,
  )

  // The escalation's identity — day + level + reasons — independent of delivery, so an
  // already-claimed escalation can be recognized (and its own slot discounted) on re-renders.
  const signature = `${localDayKey(nowMs)}|${load.level}|${load.reasons.join('+')}`
  const alreadyClaimedThis = claimedSig === signature

  // While the worktime feed or the baseline history is still loading the watch never
  // fires — a missing signal is silence, not a verdict (H3 honesty). The decision itself
  // uses the last-known windows; NEW deliveries additionally wait for `protectionFresh`.
  const decision: NudgeDecision | null = loading
    ? null
    : decideNudge({
        now: nowMs,
        minuteOfDay: minute,
        load,
        proactiveOptIn: prefs.seviProactive,
        quietStartMin: prefs.quietStartMin,
        quietEndMin: prefs.quietEndMin,
        inProtectedBlock,
        // The pre-claim count, discounting only the slot THIS escalation already claimed
        // (so a delivered line survives re-renders without re-charging). The policy gates;
        // the atomic claim below is the one and only spend.
        nudgesSentToday: nudgesSentToday(nowMs) - (alreadyClaimedThis ? 1 : 0),
        dailyCap: SEVI_DAILY_CAP,
      })

  const deliver = decision?.deliver === true
  const message = deliver ? liveMessage(load) : null

  // Delivery, once per escalation and gated on the ATOMIC budget claim: with the life-care
  // voice mounted alongside, a render-time budget check plus a later record could pass on
  // both surfaces at cap−1 and speak past the cap. Only a WON claim renders the line, fires
  // the ONE local notification, and clears a held digest; a lost claim means another surface
  // took the last slot mid-commit — this escalation stays silent, exactly like cap-reached.
  // A stale protection answer defers the claim (without burning the escalation's one attempt)
  // until this tick's 🛡 refetch has answered — never a ping into a just-confirmed window.
  useEffect(() => {
    if (!deliver || message === null || !protectionFresh) return
    if (attemptedRef.current === signature) return
    attemptedRef.current = signature
    if (!tryClaimNudge(Date.now(), SEVI_DAILY_CAP)) return
    setClaimedSig(signature)
    setHeldDigest(false)
    void createNotificationPort().notify({ title: 'Sevi', body: message })
  }, [deliver, signature, message, protectionFresh])

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

  if (deliver && message !== null && alreadyClaimedThis) {
    return { visible: true, message, digestPending: false }
  }
  if (digestLine !== null) return { visible: true, message: digestLine, digestPending: false }
  return { visible: false, message: null, digestPending: heldDigest }
}
