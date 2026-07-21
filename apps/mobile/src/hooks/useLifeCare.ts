import { useEffect, useState } from 'react'
import {
  EVENING_END_MIN,
  EVENING_START_MIN,
  decideNudge,
  freeEveningsIn,
  lifeCareSuggestions,
  type LifeCareSuggestionKind,
  type LiveLoad,
} from '@mydevtime/domain'
import { apiBaseUrl } from '../config.js'
import { getLoadHistory } from '../api/loadHistory.js'
import { getProtectedTimes, type PlanProposal } from '../api/planApply.js'
import { localDayKey } from '../autotracker/dayActivityStore.js'
import { pick } from '../i18n/strings.js'
import { SEVI_DAILY_CAP, nudgesSentToday, tryClaimNudge } from '../sevi/nudgeBudget.js'
import { useAsync } from './useAsync.js'
import { trailingHeavyRun } from './useLiveLoad.js'
import { usePreferences } from './usePreferences.js'
import { useWeekOccurrences } from './useWeekOccurrences.js'

/**
 * Sevi's life-care voices (ADR-0071 P5, REQ-071), derived from real state only:
 * - the shown week's recurring occurrences (the same feed the Planner canvas draws) turn into
 *   `freeEveningsIn` + the first work-over-life/protected clash,
 * - the caller's own load history runs through `computeBaseline` for the heavy-day run (H3 —
 *   judged against *their* history, never a fixed number),
 * and EVERY resulting suggestion is then gated through the SAME `decideNudge` policy as the
 * real-time watch: opt-in, quiet hours, an active 🛡 window, and the SHARED daily voice budget.
 * A gated-out suggestion is simply not rendered; a *held* one (quiet hours / 🛡) only sets
 * `digestPending`. A feed that is still loading or failed contributes nothing — the hook never
 * guesses (ADR-0005). Life care is care, not upsell: no credit or entitlement checks anywhere.
 */

/** One delivered life-care voice: a calm line plus the ONE confirmable protect-time act. */
export interface LifeCareVoice {
  readonly kind: LifeCareSuggestionKind
  /** The localized one-liner the card shows (and exposes as the accessible name). */
  readonly message: string
  /** The localized label of the single explicit confirm. */
  readonly confirmLabel: string
  /** The concrete act a confirm applies — always a 🛡 protect-time window (idempotent). */
  readonly proposal: Extract<PlanProposal, { kind: 'protect-time' }>
}

export interface LifeCareState {
  readonly suggestions: readonly LifeCareVoice[]
  /** A real suggestion was HELD (quiet hours / active 🛡) and may fold into one later digest. */
  readonly digestPending: boolean
}

const EMPTY: LifeCareState = { suggestions: [], digestPending: false }

const DAY_MS = 24 * 60 * 60 * 1000

/** Kinds that consume an evening / can encroach — everything that is not life or a break. */
function isWorkKind(kind: string): boolean {
  return kind !== 'life' && kind !== 'break'
}

interface Windowed {
  readonly startMin: number
  readonly endMin: number
}

/** Strict half-open overlap — touching edges do not clash. */
function overlaps(a: Windowed, b: Windowed): boolean {
  return a.startMin < b.endMin && a.endMin > b.startMin
}

/** Work minutes falling inside the evening window — the tie-breaking cost of a candidate day. */
function eveningWorkMinutes(work: readonly Windowed[]): number {
  return work.reduce(
    (sum, w) =>
      sum +
      Math.max(0, Math.min(w.endMin, EVENING_END_MIN) - Math.max(w.startMin, EVENING_START_MIN)),
    0,
  )
}

export function useLifeCare(weekDates: readonly string[]): LifeCareState {
  const base = apiBaseUrl
  const todayKey = localDayKey(Date.now())

  const occurrences = useWeekOccurrences(weekDates)
  const history = useAsync(
    () => (base !== null ? getLoadHistory(base) : Promise.resolve([])),
    `sevi-life-care-history:${base ?? 'off'}`,
  )
  const protectedToday = useAsync(
    () => (base !== null ? getProtectedTimes(base, todayKey) : Promise.resolve([])),
    `sevi-protected:${base ?? 'off'}:${todayKey}`,
  )
  const { prefs } = usePreferences()

  // The mount's budget-claim state. 'unclaimed': the delivering effect has not spoken yet.
  // 'claimed': this mount atomically won ONE slot of the shared budget — the card renders and
  // stays up (the -1 below discounts our own slot from the cap check, so a re-render neither
  // re-charges the budget nor withdraws the card mid-view). 'lost': another surface won the
  // last slot between our policy check and our claim — this round stays silent, exactly like
  // a cap-reached decision.
  const [claim, setClaim] = useState<'unclaimed' | 'claimed' | 'lost'>('unclaimed')

  let state = EMPTY
  // The policy said "deliver" and there are voices — the delivering effect below may claim.
  let wantsDelivery = false

  // Without an API there is no real week/history — honest silence, never a demo voice. The 🛡
  // feed must also have actually answered: gating on unknown protection would be a guess.
  if (base !== null && protectedToday.data !== null) {
    const protectedTimes = protectedToday.data

    // ── Evening + encroachment facts, only from a loaded occurrence feed ──────────────────
    let eveningsFree = 0
    let windowDays = 0
    let encroached: {
      id: string
      label: string
      day: string
      startMin: number
      endMin: number
    } | null = null
    if (occurrences.data !== null) {
      const blocks = occurrences.data.map(o => ({
        dayIndex: weekDates.indexOf(o.date),
        startMin: o.startMin,
        endMin: o.startMin + o.lenMin,
        kind: o.kind,
        id: o.seriesId,
        label: o.title,
        day: o.date,
      }))
      windowDays = weekDates.length
      eveningsFree = freeEveningsIn(blocks, windowDays)

      // The first work-over-life clash, scanning life blocks in day/start order (deterministic).
      const works = blocks.filter(b => isWorkKind(b.kind))
      const lifes = blocks
        .filter(b => b.kind === 'life')
        .sort((a, b) => a.dayIndex - b.dayIndex || a.startMin - b.startMin)
      for (const life of lifes) {
        if (works.some(w => w.dayIndex === life.dayIndex && overlaps(w, life))) {
          encroached = life
          break
        }
      }
      // Otherwise: work planned over one of today's 🛡 windows (ascending by start).
      if (encroached === null) {
        const todayIdx = weekDates.indexOf(todayKey)
        for (const p of [...protectedTimes].sort((a, b) => a.startMin - b.startMin)) {
          if (works.some(w => w.dayIndex === todayIdx && overlaps(w, p))) {
            encroached = {
              id: p.id,
              label: pick('protected time', 'geschützte Zeit'),
              day: p.day,
              startMin: p.startMin,
              endMin: p.endMin,
            }
            break
          }
        }
      }
    }

    // ── Rest-day fact from the person's own history (absent feed → no signal) ─────────────
    // The CURRENT run only — the run ending at the history's tail (`trailingHeavyRun`, shared
    // with the live-load watch). `computeBaseline`'s consecutive-heavy flag reports the LONGEST
    // run anywhere in the 90-day window, which would let a streak from six weeks ago — long
    // recovered from — fire the rest-day voice today.
    const consecutiveHeavyDays = trailingHeavyRun(history.data ?? [])

    const suggestions = lifeCareSuggestions({
      eveningsFreeInWindow: eveningsFree,
      windowDays,
      encroachingBlockId: encroached?.id ?? null,
      consecutiveHeavyDays,
    })

    if (suggestions.length > 0) {
      // Same policy as the real-time watch. The load is constructed honestly: a life-care
      // suggestion IS something to say (level `speak-up`), but it claims no live-load reasons
      // and crossed no legal hard cap (`hardCapHit: false`) — so it never borrows urgency.
      const now = Date.now()
      const d = new Date(now)
      const minuteOfDay = d.getHours() * 60 + d.getMinutes()
      const load: LiveLoad = { level: 'speak-up', reasons: [], hardCapHit: false }
      const decision = decideNudge({
        now,
        minuteOfDay,
        load,
        proactiveOptIn: prefs.seviProactive,
        quietStartMin: prefs.quietStartMin,
        quietEndMin: prefs.quietEndMin,
        inProtectedBlock: protectedTimes.some(
          p => p.day === todayKey && p.startMin <= minuteOfDay && minuteOfDay < p.endMin,
        ),
        // The pre-claim count: the policy gates on today's budget as it stands, but the FINAL
        // delivery is the atomic claim below — this check alone can never spend a slot.
        nudgesSentToday: nudgesSentToday(now) - (claim === 'claimed' ? 1 : 0),
        dailyCap: SEVI_DAILY_CAP,
      })

      if (!decision.deliver) {
        state = { suggestions: [], digestPending: decision.digest }
      } else if (claim === 'lost') {
        // Another surface won the last slot mid-commit: silent, exactly like cap-reached.
        state = EMPTY
      } else if (claim === 'unclaimed') {
        // The atomic claim below runs after this commit; the card appears once it wins.
        wantsDelivery = true
      } else {
        // The deterministic evening pick: among the not-yet-past days of the shown week (all of
        // them when today is off-week), the evening with the LEAST work on it — the cheapest one
        // to rescue — ties resolved to the earliest day. Same inputs, same evening, always.
        const firstCandidate = Math.max(0, weekDates.indexOf(todayKey))
        let pickIdx = firstCandidate
        let pickCost = Number.POSITIVE_INFINITY
        const occBlocks = (occurrences.data ?? []).map(o => ({
          dayIndex: weekDates.indexOf(o.date),
          startMin: o.startMin,
          endMin: o.startMin + o.lenMin,
          kind: o.kind,
        }))
        for (let day = firstCandidate; day < weekDates.length; day++) {
          const cost = eveningWorkMinutes(
            occBlocks.filter(b => b.dayIndex === day && isWorkKind(b.kind)),
          )
          if (cost < pickCost) {
            pickCost = cost
            pickIdx = day
          }
        }
        const eveningOf = (day: string): LifeCareVoice['proposal'] => ({
          kind: 'protect-time',
          day,
          startMin: EVENING_START_MIN,
          endMin: EVENING_END_MIN,
        })

        const voices: LifeCareVoice[] = suggestions.map(s => {
          if (s.kind === 'life-encroachment' && encroached !== null) {
            return {
              kind: s.kind,
              message: pick(
                `Work overlaps "${encroached.label}".`,
                `Arbeit überschneidet sich mit „${encroached.label}“.`,
              ),
              confirmLabel: pick('Protect this time', 'Diese Zeit schützen'),
              proposal: {
                kind: 'protect-time',
                day: encroached.day,
                startMin: encroached.startMin,
                endMin: encroached.endMin,
              },
            }
          }
          if (s.kind === 'no-free-evening') {
            return {
              kind: s.kind,
              message: pick(
                'This week has no free evening yet.',
                'Diese Woche hat noch keinen freien Abend.',
              ),
              confirmLabel: pick('Protect an evening?', 'Einen Abend schützen?'),
              proposal: eveningOf(weekDates[pickIdx] ?? todayKey),
            }
          }
          // rest-day: a gentle proposal only — the concrete act, if confirmed, is keeping
          // TOMORROW's evening free (never today's half-gone one, never auto-applied).
          return {
            kind: s.kind,
            message: pick(
              'Several full days in a row — tomorrow evening could stay free.',
              'Mehrere volle Tage am Stück — morgen Abend könnte frei bleiben.',
            ),
            confirmLabel: pick('Keep tomorrow evening free', 'Morgen Abend freihalten'),
            proposal: eveningOf(localDayKey(Date.now() + DAY_MS)),
          }
        })
        state = { suggestions: voices, digestPending: false }
      }
    }
  }

  // One surfacing of the card = ONE voice against the shared daily budget, however many calm
  // lines it carries. The claim is ATOMIC (check+increment in one step): with Today and the
  // Planner both mounted, a render-time check plus a later record could pass on both surfaces
  // at cap−1 and deliver past the cap — `tryClaimNudge` guarantees exactly one winner.
  useEffect(() => {
    if (wantsDelivery && claim === 'unclaimed') {
      setClaim(tryClaimNudge(Date.now(), SEVI_DAILY_CAP) ? 'claimed' : 'lost')
    }
  }, [wantsDelivery, claim])

  return state
}
