import { useCallback, useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import {
  generatePlan,
  getPlan,
  getPlanReview,
  type DayPlan,
  type GeneratePlanInput,
  type PlanCandidate,
  type PlanReview,
} from '../api/planner.js'

/**
 * The Co-Planner data source (REQ-031, ADR-0011). When an API base URL is
 * configured the hook loads today's proposed plan (generating one on first visit)
 * and lets the user re-propose; otherwise — the default in local dev and the test
 * gate — it resolves an illustrative demo plan. `live` lets the UI flag demo data.
 * The blocks are the deterministic core's; the client only renders them. The day
 * frame is 08:00–18:00; the backlog is a sensible default until real task
 * estimates feed it (a follow-up).
 */
const DAY_START = 8 * 60
const DAY_END = 18 * 60

const DEFAULT_ANCHORS = [{ startMin: 9 * 60, lenMin: 30, label: 'Daily standup' }]
const DEFAULT_BACKLOG: PlanCandidate[] = [
  { id: 'sync-engine', label: 'Sync engine', estimateMin: 150, priority: 1 },
  { id: 'finanzo', label: 'Finanzo API', estimateMin: 120, priority: 2 },
  { id: 'reviews', label: 'Code reviews', estimateMin: 60, priority: 3 },
  { id: 'nordwind', label: 'Website relaunch', estimateMin: 90, priority: 4 },
]

function todayIso(): string {
  const now = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${String(now.getFullYear())}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

function demoPlan(date: string): DayPlan {
  return {
    id: 'demo',
    date,
    version: 1,
    status: 'proposed',
    plannedFocusMin: 405,
    unplacedMin: 15,
    blocks: [
      { startMin: 480, lenMin: 60, kind: 'focus', label: 'Sync engine', taskId: 'sync-engine' },
      { startMin: 540, lenMin: 30, kind: 'meeting', label: 'Daily standup', taskId: null },
      { startMin: 570, lenMin: 90, kind: 'focus', label: 'Sync engine', taskId: 'sync-engine' },
      { startMin: 660, lenMin: 15, kind: 'break', label: 'Break', taskId: null },
      { startMin: 675, lenMin: 120, kind: 'focus', label: 'Finanzo API', taskId: 'finanzo' },
      { startMin: 795, lenMin: 60, kind: 'focus', label: 'Code reviews', taskId: 'reviews' },
      { startMin: 855, lenMin: 15, kind: 'break', label: 'Break', taskId: null },
      { startMin: 870, lenMin: 75, kind: 'focus', label: 'Website relaunch', taskId: 'nordwind' },
    ],
  }
}

function defaultInput(date: string): GeneratePlanInput {
  return {
    date,
    dayStartMin: DAY_START,
    dayEndMin: DAY_END,
    anchors: DEFAULT_ANCHORS,
    backlog: DEFAULT_BACKLOG,
  }
}

export interface PlannerResource {
  readonly plan: DayPlan | null
  readonly review: PlanReview | null
  readonly loading: boolean
  readonly error: Error | null
  readonly live: boolean
  readonly busy: boolean
  readonly dayStartMin: number
  readonly dayEndMin: number
  readonly repropose: () => void
}

export function usePlanner(): PlannerResource {
  const base = apiBaseUrl
  const live = base !== null
  const [plan, setPlan] = useState<DayPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [review, setReview] = useState<PlanReview | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const date = todayIso()
    const load: Promise<DayPlan | null> =
      base === null
        ? Promise.resolve(demoPlan(date))
        : getPlan(base, date).then(existing => existing ?? generatePlan(base, defaultInput(date)))
    load
      .then(p => {
        if (!alive) return
        setPlan(p)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [base, reloadKey])

  // Evening review: plan-vs-actual focus. Live plans read the deterministic core's
  // review; the demo shows an illustrative under-plan drift.
  useEffect(() => {
    if (plan === null) {
      setReview(null)
      return
    }
    if (base === null) {
      const tracked = Math.max(0, plan.plannedFocusMin - 45)
      setReview({
        plannedFocusMin: plan.plannedFocusMin,
        trackedFocusMin: tracked,
        driftMin: tracked - plan.plannedFocusMin,
      })
      return
    }
    let alive = true
    getPlanReview(base, plan.id)
      .then(r => {
        if (alive) setReview(r)
      })
      .catch(() => {
        if (alive) setReview(null)
      })
    return () => {
      alive = false
    }
  }, [base, plan])

  const repropose = useCallback(() => {
    if (base === null) {
      setReloadKey(k => k + 1) // demo: re-resolve the demo plan
      return
    }
    setBusy(true)
    generatePlan(base, defaultInput(todayIso()))
      .then(p => {
        setPlan(p)
        setError(null)
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        setBusy(false)
      })
  }, [base])

  return {
    plan,
    review,
    loading,
    error,
    live,
    busy,
    dayStartMin: DAY_START,
    dayEndMin: DAY_END,
    repropose,
  }
}
