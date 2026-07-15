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

/**
 * The Co-Planner data source (REQ-031, ADR-0011). When an API base URL is
 * configured the hook loads today's proposed plan and lets the user re-propose;
 * otherwise — the default in local dev and the test gate — there is no plan and the
 * screen shows its empty state. The app fabricates no plan and sends no invented
 * backlog to the backend; real anchors/estimates from the calendar + tracking data
 * feed the generator in a follow-up. `live` lets the UI flag that the plan is
 * API-backed; the blocks are the deterministic core's. The day frame is 08:00–18:00.
 */
const DAY_START = 8 * 60
const DAY_END = 18 * 60

function todayIso(): string {
  const now = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${String(now.getFullYear())}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/**
 * The generator input for a re-propose. Until the calendar/tracking feed real
 * anchors + task estimates (a follow-up) there are none, so a re-propose yields an
 * honestly empty day rather than an invented one.
 */
function defaultInput(date: string): GeneratePlanInput {
  return {
    date,
    dayStartMin: DAY_START,
    dayEndMin: DAY_END,
    anchors: [],
    backlog: [] as PlanCandidate[],
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
  const [plan, setPlan] = useState<DayPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState<PlanReview | null>(null)
  const [briefing, setBriefing] = useState<PlanBriefing | null>(null)
  const [briefingBusy, setBriefingBusy] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const date = todayIso()
    const load: Promise<DayPlan | null> =
      base === null ? Promise.resolve(null) : getPlan(base, date)
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
  }, [base])

  // Evening review: plan-vs-actual focus, read from the deterministic core.
  useEffect(() => {
    if (plan === null || base === null) {
      setReview(null)
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
    if (plan === null || base === null) return
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
    if (plan === null || base === null) return
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
    if (base === null) return // no backend → nothing to propose
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
