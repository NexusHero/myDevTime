import { getJson } from './http.js'
import { z } from 'zod'

/**
 * The load-history client seam (ADR-0071 P1): the caller's own per-day load-score series
 * (oldest→newest), exactly the shape `computeBaseline` consumes — so the live-load watch and
 * the life-care voices judge "hard" against *this person's* band (H3), never a fixed number.
 * A malformed row throws — the client never invents a history it doesn't have.
 */
export const loadHistoryDaySchema = z.object({
  loadScore: z.number(),
  weekday: z.number().int().min(0).max(6),
})
export type LoadHistoryDay = z.infer<typeof loadHistoryDaySchema>

/** The caller's load-score series for the window (default 90 days), oldest→newest. */
export async function getLoadHistory(
  baseUrl: string,
  days = 90,
  fetchImpl: typeof fetch = fetch,
): Promise<readonly LoadHistoryDay[]> {
  return z
    .array(loadHistoryDaySchema)
    .parse(await getJson(baseUrl, `/api/wellbeing/load-history?days=${String(days)}`, fetchImpl))
}
