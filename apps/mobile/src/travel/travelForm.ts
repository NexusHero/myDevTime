import {
  effectiveFraction,
  priceTravel,
  returnTrip,
  type TravelLeg,
  type TravelMode,
  type TravelRatePolicy,
} from '@mydevtime/domain'

/**
 * Pure glue for the travel route-card drawer (REQ-051, design v13 G4). Turns the drawer's
 * form into a deterministic `TravelLeg` and a human note, and exposes a sensible default
 * rate policy. All the money/worktime math stays in `@mydevtime/domain#priceTravel`
 * (ADR-0005); this module only shapes inputs/outputs and never persists. Location is a
 * plain place label (from/to), used only at the endpoints — never streamed (ADR-0058/0059).
 */

/** Workspace-agnostic defaults until per-workspace travel policy is stored: car time at
 *  50 %, a 0.30/km mileage allowance, and a train counted as full worktime. */
export const DEFAULT_TRAVEL_POLICY: TravelRatePolicy = {
  timeRatePerHourMinor: 0,
  timeFraction: 0.5,
  perKmMinor: 30,
  trainCountsAsWorktime: true,
}

export interface TravelForm {
  readonly from: string
  readonly to: string
  readonly distanceKm: number
  readonly mode: TravelMode
  /** Trip duration in minutes. */
  readonly durationMin: number
  /** Billable at all (the drawer's "add to invoice" toggle). */
  readonly billable: boolean
}

/** Build a `TravelLeg` that ends at `now` and spans `durationMin` (the drawer default:
 *  you log a trip you just finished). Non-finite/negative inputs are clamped to zero. */
export function buildLeg(form: TravelForm, now: Date, id = 'travel'): TravelLeg {
  const durationMs = Math.max(0, Math.round((form.durationMin || 0) * 60_000))
  const endMs = now.getTime()
  return {
    id,
    from: form.from.trim(),
    to: form.to.trim(),
    startMs: endMs - durationMs,
    endMs,
    distanceKm: Number.isFinite(form.distanceKm) && form.distanceKm > 0 ? form.distanceKm : 0,
    mode: form.mode,
  }
}

/** A stable, human note for the created entry: `Travel: A → B (42 km, car)`. */
export function travelNote(leg: TravelLeg): string {
  const km = leg.distanceKm > 0 ? `${String(leg.distanceKm)} km, ` : ''
  const route = leg.from && leg.to ? `${leg.from} → ${leg.to}` : leg.from || leg.to || 'trip'
  return `Travel: ${route} (${km}${leg.mode})`
}

/** Swap the endpoints for the return-trip nudge, keeping distance and mode (a fresh form). */
export function returnForm(form: TravelForm): TravelForm {
  const r = returnTrip(buildLeg(form, new Date(0)))
  return { ...form, from: r.from, to: r.to, distanceKm: r.distanceKm, mode: r.mode }
}

export interface TravelPreview {
  readonly worktimeMs: number
  readonly appliedFraction: number
  readonly distanceMinor: number
  readonly isFullWorktime: boolean
}

/** The deterministic preview the drawer shows: worktime credited, mileage allowance, and
 *  whether this mode counts as full worktime (a train under the policy). */
export function previewLeg(form: TravelForm, policy = DEFAULT_TRAVEL_POLICY): TravelPreview {
  const cost = priceTravel(buildLeg(form, new Date(0)), policy)
  return {
    worktimeMs: cost.worktimeMs,
    appliedFraction: cost.appliedFraction,
    distanceMinor: cost.distanceMinor,
    isFullWorktime: effectiveFraction(form.mode, policy) === 1,
  }
}
