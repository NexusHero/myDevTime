import { useCallback, useEffect, useState } from 'react'
import { blockIdOf, reflowDay, type FixedObstacle, type ReflowProposal } from '@mydevtime/domain'
import { apiBaseUrl } from '../config.js'
import { applyPlanProposal, getProtectedTimes, type ProtectedTime } from '../api/planApply.js'
import { recordStretchAck } from '../sevi/stretchAck.js'
import type { PlannerResource } from './usePlanner.js'

/**
 * One-tap day repair (ADR-0072 D1, REQ-072): turns a broken day into a ghost proposal and one
 * confirmable act. The hook only *composes* — the re-layout and every figure it shows are the
 * pure `reflowDay` core's (ADR-0005), the mutation is the plan-apply seam's (`relayout-day`,
 * provenance `planner-reflow`, a NEW accepted plan version server-side). The plan never moves
 * without the tap: `dismiss` closes the preview and changes nothing.
 *
 * The break is judged by the SAME drift signal Today's drift chip already uses — the
 * deterministic `PlanReview` drift at ≤ −30 min (design v20 §Today) — and the re-laid set is
 * the accepted plan's focus blocks whose window has fully passed unfinished. Accepting a
 * `stretch` proposal records the day-scoped stretch acknowledgment (`sevi/stretchAck`), which
 * `useSeviWatch` feeds into `decideNudge` — chosen, not drifted into; hard caps stay loud.
 */

/** The same materially-behind-plan line Today's drift → re-plan moment uses (design v20). */
export const DRIFT_REPAIR_THRESHOLD_MIN = -30

/**
 * The ArbZG-derived span from the day's first planned minute to its hard end: at most 10 h of
 * work (ArbZG §3) plus the 45 min of legally required breaks a full day carries (ArbZG §4) —
 * the universal cap of REQ-067, projected onto the plan's own frame. `reflowDay` never lays
 * past it.
 */
export const ARBZG_DAY_SPAN_MIN = 10 * 60 + 45

/** Re-evaluation cadence, mirroring `useSeviWatch` / `useLiveLoad` (cheap, no network). */
const TICK_MS = 30_000

/** Minutes-from-midnight → `HH:MM`. */
function hhmm(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}`
}

/** The device-local `YYYY-MM-DD` (the day the 🛡 protected windows are keyed by). */
function localDateISO(ms: number): string {
  const d = new Date(ms)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${String(d.getFullYear())}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** The device-local minute of day (0..1439). */
function localMinuteOfDay(ms: number): number {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

/** One ghost placement, labeled for rendering. */
export interface RepairPlacement {
  readonly id: string
  readonly label: string
  readonly startMin: number
  readonly lenMin: number
  /** `HH:MM–HH:MM`, the Co-Planner card's time convention. */
  readonly timeLabel: string
}

export interface DayRepairResource {
  /** The pure core's proposal — `null` while the day needs no repair (then nothing renders). */
  readonly proposal: ReflowProposal | null
  /** The pre-tap stretch price (issue-fixed copy), or `null` when not stretching. */
  readonly price: string | null
  /** The proposal's placements, labeled for the ghost preview. */
  readonly placements: readonly RepairPlacement[]
  /** Labels of the blocks that move to tomorrow/backlog when `overflow.kind === 'moved'`. */
  readonly movedLabels: readonly string[]
  /** Whether the ghost preview is open. */
  readonly previewOpen: boolean
  readonly openPreview: () => void
  /** Apply the repair through the plan-apply seam — the ONLY mutation of this feature. */
  readonly apply: () => void
  /** Close the preview. Changes NOTHING — the plan never moves without the tap. */
  readonly dismiss: () => void
  readonly applying: boolean
  /** The last apply failed (surfaced honestly; the preview stays open to retry/dismiss). */
  readonly error: Error | null
}

export function useDayRepair(planner: PlannerResource): DayRepairResource {
  const base = apiBaseUrl
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [protectedTimes, setProtectedTimes] = useState<readonly ProtectedTime[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now())
    }, TICK_MS)
    return () => {
      clearInterval(id)
    }
  }, [])

  // Today's 🛡 windows are FIXED obstacles for the reflow (REQ-057/070: a repair must never
  // lay work over a protected block). Honest degradation: on a fetch error the repair simply
  // proposes without shields rather than blocking — the server-side apply stays the authority.
  const today = localDateISO(nowMs)
  useEffect(() => {
    if (base === null) return
    let alive = true
    getProtectedTimes(base, today)
      .then(windows => {
        if (alive) setProtectedTimes(windows)
      })
      .catch(() => {
        if (alive) setProtectedTimes([])
      })
    return () => {
      alive = false
    }
  }, [base, today])

  const plan = planner.plan
  const review = planner.review
  const nowMin = localMinuteOfDay(nowMs)

  // The existing drift detection (Today's drift chip, design v20): materially behind plan.
  const drifted = review !== null && review.driftMin <= DRIFT_REPAIR_THRESHOLD_MIN
  // The blocks judged missed: accepted-plan focus blocks whose window has fully passed while
  // the day is behind plan. Breaks are not re-laid (a skipped break is not debt to reschedule)
  // and meetings are pinned by the domain core itself.
  const missedIds =
    plan === null
      ? []
      : plan.blocks
          .map((b, i) => ({ b, id: blockIdOf(i) }))
          .filter(({ b }) => b.kind === 'focus' && b.startMin + b.lenMin <= nowMin)
          .map(({ id }) => id)

  const repairable =
    planner.live &&
    plan !== null &&
    plan.status === 'accepted' &&
    plan.blocks.length > 0 &&
    drifted &&
    missedIds.length > 0

  let proposal: ReflowProposal | null = null
  if (repairable) {
    const firstStart = plan.blocks.reduce((min, b) => Math.min(min, b.startMin), 1440)
    const lastEnd = plan.blocks.reduce((max, b) => Math.max(max, b.startMin + b.lenMin), 0)
    const fixed: FixedObstacle[] = protectedTimes
      .filter(w => w.day === today)
      .map(w => ({ startMin: w.startMin, endMin: w.endMin }))
    proposal = reflowDay({
      nowMin,
      // The universal ArbZG cap projected onto the plan's own frame (REQ-067): first planned
      // minute + max work span. Never past midnight — the repair does not plan into tomorrow.
      dayEndCapMin: Math.min(1440, firstStart + ARBZG_DAY_SPAN_MIN),
      // The personal line is the accepted plan's own end — the Feierabend the user signed up
      // for. Laying past it is the informed stretch deal, priced below.
      capacityLineMin: lastEnd,
      blocks: plan.blocks.map((b, i) => ({
        id: blockIdOf(i),
        startMin: b.startMin,
        lenMin: b.lenMin,
        kind: b.kind,
      })),
      fixed,
      missedIds,
    })
    // A repair that would change nothing is no repair — render nothing rather than a no-op tap.
    if (proposal.placements.length === 0 && proposal.overflow.kind === 'fits') proposal = null
  }

  const labelOf = (id: string): string => plan?.blocks[Number(id)]?.label ?? id
  const placements: readonly RepairPlacement[] = (proposal?.placements ?? []).map(p => ({
    id: p.id,
    label: labelOf(p.id),
    startMin: p.startMin,
    lenMin: p.lenMin,
    timeLabel: `${hhmm(p.startMin)}–${hhmm(p.startMin + p.lenMin)}`,
  }))
  const movedLabels: readonly string[] =
    proposal !== null && proposal.overflow.kind === 'moved'
      ? proposal.overflow.movedBlockIds.map(labelOf)
      : []
  // The informed deal's price, stated BEFORE the tap — issue-fixed copy (ADR-0072 D1).
  const price =
    proposal !== null && proposal.overflow.kind === 'stretch'
      ? `+${String(proposal.overflow.overLineMin)} min über deiner Linie · Feierabend ~${hhmm(proposal.overflow.projectedEndMin)}`
      : null

  const openPreview = useCallback(() => {
    setError(null)
    setPreviewOpen(true)
  }, [])

  // Dismiss changes NOTHING — no request, no state beyond closing the preview (ADR-0072 D1).
  const dismiss = useCallback(() => {
    setError(null)
    setPreviewOpen(false)
  }, [])

  const apply = useCallback(() => {
    if (base === null || plan === null || proposal === null || applying) return
    setApplying(true)
    setError(null)
    applyPlanProposal(base, {
      kind: 'relayout-day',
      planId: plan.id,
      placements: proposal.placements.map(p => ({
        blockId: p.id,
        startMin: p.startMin,
        lenMin: p.lenMin,
      })),
      provenance: 'planner-reflow',
    })
      .then(async () => {
        // A consciously accepted stretch is CHOSEN, not drifted into: acknowledge it for the
        // rest of the day so Sevi's own-baseline tier stays quiet (hard caps stay loud —
        // enforced by the domain policy, not here).
        if (proposal.overflow.kind === 'stretch') recordStretchAck(Date.now())
        setPreviewOpen(false)
        await planner.refresh() // the seam wrote a new accepted version — re-read it in place
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        setApplying(false)
      })
  }, [base, plan, proposal, applying, planner])

  return {
    proposal,
    price,
    placements,
    movedLabels,
    previewOpen,
    openPreview,
    apply,
    dismiss,
    applying,
    error,
  }
}
