import { toSeriesProposals, type SeriesProposal } from '@mydevtime/domain'
import { ScheduleImportUnavailableError, type ImageInput, type ScheduleImportPort } from './port.js'

/**
 * Photo/mail schedule import planning (REQ-064, design v17 §F6 KI5): extract a timetable from a
 * photo through the narrow `ScheduleImportPort`, then shape the lessons into recurring-**series**
 * proposals with the deterministic `toSeriesProposals` core (ADR-0005). The result is a **ghost**
 * proposal list the user confirms — never booked here. Three gates come first, in order: **Pro**
 * (this is a paid AI difference-maker — violet, one credit), **consent** (no capture without
 * stored opt-in, REQ-025), and **availability** (a down/unconfigured model degrades to nothing,
 * never throws up the stack). The live vision adapter is spike-gated; the Null adapter proves the
 * seam. The credit is charged by the caller only on a confirmed booking, never on the proposal.
 */

/** What the KI5 import proposes — ghost series to confirm, plus the honest reason when empty. */
export interface PhotoImportPlan {
  readonly proposals: readonly SeriesProposal[]
  readonly status: 'ok' | 'not-pro' | 'no-consent' | 'unavailable'
  /** Credits a confirmed import would cost (informational; charged on booking, not here). */
  readonly creditCost: number
}

/** KI5 is a Pro AI difference-maker: one credit per confirmed import (charged on booking). */
export const PHOTO_IMPORT_CREDIT_COST = 1

const EMPTY = (status: PhotoImportPlan['status']): PhotoImportPlan => ({
  proposals: [],
  status,
  creditCost: PHOTO_IMPORT_CREDIT_COST,
})

export interface PhotoImportGates {
  /** Whether the account holds Pro (the money/AI floor; ADR-0006). */
  readonly hasPro: boolean
  /** Whether the user has opted in to photo capture (REQ-025). */
  readonly consented: boolean
  /** The reference "today" (UTC-midnight ms) the series anchor is computed from — deterministic. */
  readonly fromDateMs: number
}

/**
 * Plan a photo import: Pro-gated, consent-gated, availability-gated, then a deterministic shaping
 * into series proposals. Returns proposals only — the caller books nothing until the user confirms
 * a ghost series. A provider that throws `ScheduleImportUnavailableError` mid-extract degrades to
 * an empty `unavailable` plan (ADR-0005).
 */
export async function planPhotoImport(
  port: ScheduleImportPort,
  image: ImageInput,
  gates: PhotoImportGates,
): Promise<PhotoImportPlan> {
  if (!gates.hasPro) return EMPTY('not-pro')
  if (!gates.consented) return EMPTY('no-consent')
  if (!(await port.available())) return EMPTY('unavailable')
  let lessons
  try {
    lessons = await port.extractSchedule(image)
  } catch (err) {
    if (err instanceof ScheduleImportUnavailableError) return EMPTY('unavailable')
    throw err
  }
  return {
    proposals: toSeriesProposals(lessons, gates.fromDateMs),
    status: 'ok',
    creditCost: PHOTO_IMPORT_CREDIT_COST,
  }
}
