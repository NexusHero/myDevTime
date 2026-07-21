import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  commitmentAdvisory,
  type AdvisoryBlock,
  type CommitmentAdvisory,
  type CommitmentLevel,
} from '@mydevtime/domain'
import { apiBaseUrl } from '../config.js'
import { applyPlanProposal, getProtectedTimes, type PlanProposal } from '../api/planApply.js'
import { getPlan, type DayPlan } from '../api/planner.js'
import type { Occurrence } from '../api/recurrence.js'
import { weekCapacityFromBlocks, type CapacityBlock } from '../planner/capacityTrace.js'

/**
 * Sevi's Scrum-Master data source at planning time (REQ-070, ADR-0071). Computes the
 * over-commitment advisory CLIENT-SIDE over exactly the data the Planner already holds —
 * the local canvas blocks, the week's persisted recurrence occurrences, today's persisted
 * Co-Planner plan, and the server's 🛡 protected windows — with every figure owned by the
 * deterministic `commitmentAdvisory` core (ADR-0005). Nothing here mutates on its own:
 * every confirm routes through `applyPlanProposal`, the ONE plan-apply seam.
 *
 * THE RELIEF → PROPOSAL MAPPING (the contract this hook chose on contact):
 * - A relief candidate backed by a **persisted plan block** (today's Co-Planner plan, focus
 *   kind) confirms as `{kind:'shrink-block', planId, blockId, byMin}` — the server runs the
 *   pure mutation and persists a NEW accepted plan version, so the change survives reload.
 * - A relief candidate backed by a **recurrence occurrence** (or a local canvas block) has
 *   no plan/blockId the seam could address, so it confirms as the honest fallback
 *   `{kind:'protect-time', day, startMin, endMin}` over that block's exact slot — a durable,
 *   idempotent 🛡 window, verifiable after reload via `GET /api/planner/protected`.
 *
 * THE ACCOUNTING (kept coherent so a confirmed protect-time visibly lowers the overage):
 * - Plannable capacity = `weekCapacityFromBlocks` (the REQ-055 core, reused) over the canvas'
 *   life/protected blocks PLUS the week's `life` occurrences. Life time is capacity-side
 *   only — it is never load, and this mapping offers no relief on it (no seam can move a
 *   life commitment yet, and a buddy does not propose cutting family time).
 * - Planned load = work occurrences + work canvas blocks + today's plan blocks. Booked
 *   (`actual`) and `travel` blocks count as immovable load (mapped to the advisory's
 *   `meeting` kind) — relief must never touch booked history or other people's time.
 * - A Sevi-confirmed 🛡 window DISPLACES the planned work it covers: overlapped minutes
 *   leave the load. It is deliberately NOT also counted as a life commitment — one honest
 *   effect per window, otherwise protecting a slot could never reduce the overage.
 *
 * UNDO VIA THE SEAM: `shrink-block` cannot grow (the server floors `byMin` at 0) and
 * `protect-time` has no unprotect proposal, so no proposal this mapping emits has a seam-
 * representable inverse. `undoLastAvailable` is therefore honestly `false` today; the
 * surface stays so a future `move-block` mapping (whose inverse IS a move back) lights it
 * up without changing callers.
 */

/** The minimum shape the advisory needs from the Planner's local canvas blocks. */
export interface AdvisoryCanvasBlock {
  /** Day index within the shown week (0-based). */
  readonly day: number
  /** Start, minutes from the canvas' 08:00 top. */
  readonly start: number
  readonly len: number
  readonly label: string
  readonly kind: string
  readonly protectedFlag?: boolean
}

export interface PlanAdvisoryInput {
  readonly blocks: readonly AdvisoryCanvasBlock[]
  /** The shown week's day columns as `YYYY-MM-DD`, in order. */
  readonly weekDates: readonly string[]
  readonly occurrences: readonly Occurrence[]
}

/** One confirmable relief option, already mapped to its concrete seam proposal. */
export interface ReliefOption {
  readonly key: string
  /** The human title of the block giving relief. */
  readonly title: string
  readonly action: 'shrink' | 'protect'
  /** Minutes of planned load this confirm would free. */
  readonly freedMin: number
  readonly proposal: PlanProposal
}

export interface PlanAdvisoryResource {
  /** The worse of the day/week severity — the banner shows for anything but `within`. */
  readonly level: CommitmentLevel
  readonly advisory: CommitmentAdvisory
  /** Week figures for the banner: honest plannable vs. planned (both ms). */
  readonly plannableMs: number
  readonly plannedMs: number
  readonly options: readonly ReliefOption[]
  readonly busy: boolean
  /** Apply one option through the seam; true = persisted (state refetched). */
  readonly confirm: (option: ReliefOption) => Promise<boolean>
  /** See the header: no emitted proposal has a seam-representable inverse today. */
  readonly undoLastAvailable: boolean
  readonly undoLast: () => Promise<boolean>
}

/** The canvas' day frame starts at 08:00 — canvas `start` is minutes from there. */
const CANVAS_DAY_START_MIN = 8 * 60

function todayIso(): string {
  const now = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${String(now.getFullYear())}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** A protected window on a day, minute-of-day. */
interface Shield {
  readonly day: string
  readonly startMin: number
  readonly endMin: number
}

/** Minutes of `[startMin, startMin+lenMin)` covered by the day's 🛡 windows (merged naively —
 *  windows are idempotent server-side and rarely overlap; over-subtraction is clamped). */
function shieldedMin(
  date: string,
  startMin: number,
  lenMin: number,
  shields: readonly Shield[],
): number {
  let covered = 0
  for (const s of shields) {
    if (s.day !== date) continue
    covered += Math.max(0, Math.min(startMin + lenMin, s.endMin) - Math.max(startMin, s.startMin))
  }
  return Math.min(covered, lenMin)
}

/** One load entry: the advisory block plus what a confirm on it concretely does. */
interface LoadEntry {
  readonly adv: AdvisoryBlock
  readonly title: string
  readonly source:
    | { readonly type: 'plan'; readonly planId: string; readonly blockIndex: number }
    | {
        readonly type: 'slot'
        readonly day: string
        readonly startMin: number
        readonly endMin: number
      }
}

/** Map a canvas/occurrence kind to the advisory's load kinds; null = not load (life/unknown). */
function loadKindOf(kind: string): AdvisoryBlock['kind'] | null {
  if (kind === 'focus' || kind === 'ghost') return 'focus'
  // Booked history, meetings and travel are immovable load: counted, never offered as relief.
  if (kind === 'meeting' || kind === 'actual' || kind === 'travel') return 'meeting'
  if (kind === 'break') return 'break'
  return null
}

export function usePlanAdvisory(input: PlanAdvisoryInput): PlanAdvisoryResource {
  const base = apiBaseUrl
  const { blocks, weekDates, occurrences } = input
  const weekKey = weekDates.join(',')
  const [shields, setShields] = useState<readonly Shield[]>([])
  const [plan, setPlan] = useState<DayPlan | null>(null)
  const [busy, setBusy] = useState(false)

  const loadServerState = useCallback(async (): Promise<void> => {
    if (base === null || weekDates.length === 0) {
      setShields([])
      setPlan(null)
      return
    }
    // Best-effort reads: a failed fetch means "no shields / no plan", never a crash — the
    // advisory then simply runs on what the Planner holds locally.
    const [shieldLists, dayPlan] = await Promise.all([
      Promise.all(weekDates.map(day => getProtectedTimes(base, day).catch(() => []))),
      weekDates.includes(todayIso())
        ? getPlan(base, todayIso()).catch(() => null)
        : Promise.resolve(null),
    ])
    setShields(
      shieldLists.flat().map(p => ({ day: p.day, startMin: p.startMin, endMin: p.endMin })),
    )
    setPlan(dayPlan)
    // Deliberately keyed on the JOINED dates, not the array identity: the Planner rebuilds
    // `weekDates` every render, and an identity key would refetch on every keystroke.
  }, [base, weekKey])

  useEffect(() => {
    void loadServerState()
  }, [loadServerState])

  const { advisory, entries, plannableMs, plannedMs } = useMemo(() => {
    // Capacity side: the canvas' own life/protected blocks + the week's life occurrences.
    const lifeOccurrenceBlocks: CapacityBlock[] = occurrences
      .filter(o => o.kind === 'life' && weekDates.includes(o.date))
      .map(o => ({
        day: weekDates.indexOf(o.date),
        start: o.startMin - CANVAS_DAY_START_MIN,
        len: o.lenMin,
        kind: 'life',
      }))
    const week = weekCapacityFromBlocks([...blocks, ...lifeOccurrenceBlocks], {
      availableDays: weekDates.length,
    })

    const todayIdx = weekDates.indexOf(todayIso())
    const list: LoadEntry[] = []
    const push = (
      kind: AdvisoryBlock['kind'],
      day: number,
      date: string,
      startMin: number,
      lenMin: number,
      title: string,
      source: LoadEntry['source'],
      protectedFlag: boolean,
    ): void => {
      const effLen = lenMin - shieldedMin(date, startMin, lenMin, shields)
      if (effLen <= 0) return // fully displaced by a confirmed 🛡 window — already relieved
      list.push({
        adv: {
          kind,
          startMin,
          lenMin: effLen,
          ...(day >= 0 ? { day } : {}),
          ...(protectedFlag ? { protectedFlag } : {}),
        },
        title,
        source,
      })
    }
    for (const b of blocks) {
      const kind = loadKindOf(b.kind)
      const date = weekDates[b.day]
      if (kind === null || date === undefined) continue
      const startMin = CANVAS_DAY_START_MIN + b.start
      push(
        kind,
        b.day,
        date,
        startMin,
        b.len,
        b.label,
        {
          type: 'slot',
          day: date,
          startMin,
          endMin: startMin + b.len,
        },
        b.protectedFlag === true,
      )
    }
    for (const o of occurrences) {
      const kind = loadKindOf(o.kind)
      const day = weekDates.indexOf(o.date)
      if (kind === null || day < 0) continue
      push(
        kind,
        day,
        o.date,
        o.startMin,
        o.lenMin,
        o.title,
        {
          type: 'slot',
          day: o.date,
          startMin: o.startMin,
          endMin: o.startMin + o.lenMin,
        },
        false,
      )
    }
    if (plan !== null && todayIdx >= 0) {
      const date = weekDates[todayIdx] ?? ''
      plan.blocks.forEach((b, blockIndex) => {
        push(
          b.kind,
          todayIdx,
          date,
          b.startMin,
          b.lenMin,
          b.label,
          {
            type: 'plan',
            planId: plan.id,
            blockIndex,
          },
          false,
        )
      })
    }

    const result = commitmentAdvisory(
      week,
      list.map(e => e.adv),
    )
    return {
      advisory: result,
      entries: list,
      plannableMs: week.plannableMs,
      plannedMs: result.weekOverageMs + week.plannableMs,
    }
  }, [blocks, occurrences, weekDates, plan, shields])

  const level: CommitmentLevel =
    advisory.weekLevel === 'over' || advisory.dayLevel === 'over'
      ? 'over'
      : advisory.weekLevel === 'tight' || advisory.dayLevel === 'tight'
        ? 'tight'
        : 'within'

  const options: readonly ReliefOption[] = useMemo(() => {
    const overageMin = Math.max(
      15,
      Math.ceil(Math.max(advisory.weekOverageMs, advisory.dayOverageMs) / 60_000),
    )
    const opts: ReliefOption[] = []
    for (const r of advisory.relief) {
      const entry = entries[Number(r.blockId)]
      if (entry === undefined) continue
      const movableMin = Math.round(r.movableMs / 60_000)
      if (entry.source.type === 'plan') {
        opts.push({
          key: `shrink:${entry.source.planId}:${String(entry.source.blockIndex)}`,
          title: entry.title,
          action: 'shrink',
          freedMin: Math.min(movableMin, overageMin),
          proposal: {
            kind: 'shrink-block',
            planId: entry.source.planId,
            blockId: String(entry.source.blockIndex),
            byMin: Math.min(movableMin, overageMin),
          },
        })
      } else {
        opts.push({
          key: `protect:${entry.source.day}:${String(entry.source.startMin)}`,
          title: entry.title,
          action: 'protect',
          // Protecting the slot displaces the block's whole remaining load.
          freedMin: entry.adv.lenMin,
          proposal: {
            kind: 'protect-time',
            day: entry.source.day,
            startMin: entry.source.startMin,
            endMin: entry.source.endMin,
          },
        })
      }
    }
    return opts
  }, [advisory, entries])

  const confirm = useCallback(
    async (option: ReliefOption): Promise<boolean> => {
      if (base === null) return false // no backend → nothing could persist; stay honest
      setBusy(true)
      try {
        await applyPlanProposal(base, option.proposal)
        // Refetch what the confirm changed so the figures drop from persisted state,
        // not from an optimistic guess.
        await loadServerState()
        return true
      } catch {
        return false
      } finally {
        setBusy(false)
      }
    },
    [base, loadServerState],
  )

  // See the header comment: no emitted proposal is invertible through the seam today.
  const undoLast = useCallback(async (): Promise<boolean> => Promise.resolve(false), [])

  return {
    level,
    advisory,
    plannableMs,
    plannedMs,
    options,
    busy,
    confirm,
    undoLastAvailable: false,
    undoLast,
  }
}
