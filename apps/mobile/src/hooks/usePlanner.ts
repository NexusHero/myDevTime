import { useCallback, useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import {
  generatePlan,
  getPlan,
  getPlanBriefing,
  getPlanReview,
  setPlanStatus,
  type DayPlan,
  type GeneratePlanInput,
  type PlanBriefing,
  type PlanCandidate,
  type PlanReview,
} from '../api/planner.js'
import { useLocalDb } from '../localDb/LocalDbProvider.js'
import { getPlanByDate, setPlanStatus as setLocalPlanStatus, upsertPlan } from '@mydevtime/local-db'

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
    droppedAnchors: [{ startMin: 540, lenMin: 30, label: 'Vendor sync (overlaps standup)' }],
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
  /** Accept the current proposal — persists status = accepted (M5). */
  readonly accept: () => void
  /** The AI day-briefing, once requested (M8). */
  readonly briefing: PlanBriefing | null
  readonly briefingBusy: boolean
  readonly requestBriefing: () => void
}

export function usePlanner(): PlannerResource {
  const base = apiBaseUrl
  const live = base !== null
  const db = useLocalDb()
  const [plan, setPlan] = useState<DayPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)
  const [reloadKey] = useState(0)
  const [review, setReview] = useState<PlanReview | null>(null)
  const [briefing, setBriefing] = useState<PlanBriefing | null>(null)
  const [briefingBusy, setBriefingBusy] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const date = todayIso()
    const load: Promise<DayPlan | null> =
      base === null
        ? getPlanByDate(db, date).then(existing => {
            if (existing) return existing as unknown as DayPlan
            const newPlan = demoPlan(date)
            return upsertPlan(db, newPlan as any).then(p => p as unknown as DayPlan)
          })
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

  const requestBriefing = useCallback(() => {
    if (plan === null) return
    if (base === null) {
      // Demo: an illustrative deterministic summary (the AI text needs the backend).
      const meetings = plan.blocks.filter(b => b.kind === 'meeting').length
      const parts = [
        `Heute ${String(Math.round(plan.plannedFocusMin / 60))} h Fokus, ${String(meetings)} Termine.`,
      ]
      if (plan.unplacedMin > 0)
        parts.push('Backlog ohne Platz — priorisiere die wichtigsten Aufgaben.')
      setBriefing({ source: 'deterministic', charged: false, text: parts.join(' ') })
      return
    }
    setBriefingBusy(true)
    getPlanBriefing(base, plan.id)
      .then(b => {
        setBriefing(b)
        setError(null)
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        setBriefingBusy(false)
      })
  }, [base, plan])

  const accept = useCallback(() => {
    if (plan === null) return
    if (base === null) {
      setBusy(true)
      setLocalPlanStatus(db, plan.id, 'accepted')
        .then(() => {
          setPlan({ ...plan, status: 'accepted', version: plan.version + 1 })
          setError(null)
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause : new Error(String(cause)))
        })
        .finally(() => {
          setBusy(false)
        })
      return
    }
    setBusy(true)
    setPlanStatus(base, plan.id, 'accepted')
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
  }, [base, plan])

  const repropose = useCallback(() => {
    setBriefing(null)
    if (base === null) {
      setBusy(true)
      const newPlan = demoPlan(todayIso())
      upsertPlan(db, newPlan as any)
        .then(p => {
          setPlan(p as unknown as DayPlan)
          setError(null)
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause : new Error(String(cause)))
        })
        .finally(() => {
          setBusy(false)
        })
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
    accept,
    briefing,
    briefingBusy,
    requestBriefing,
  }
}
