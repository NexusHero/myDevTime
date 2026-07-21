import { deleteJson, getJson, postJson } from './http.js'
import { z } from 'zod'

/**
 * The mood client seam (ADR-0071 P3, REQ-068): the punch-out MoodCheck's word, persisted by
 * the `wellbeing` module **only** under the stored `moodConsent` preference. The server
 * enforces consent (an honest 409 → `ApiError` here, which the MoodCheck explains rather than
 * swallowing); this client only posts the word, reads the newest-first history, and erases it
 * all with one DELETE (deletable memory, one action). A malformed history throws — the client
 * never invents a mood.
 */
export const moodSchema = z.enum(['good', 'tense', 'stressed'])
export type Mood = z.infer<typeof moodSchema>

export const moodDaySchema = z.object({
  day: z.string(),
  mood: moodSchema,
})
export type MoodDay = z.infer<typeof moodDaySchema>

/** Record today's punch-out mood (the server keys the day); returns the stored day. */
export async function postMood(
  baseUrl: string,
  mood: Mood,
  fetchImpl: typeof fetch = fetch,
): Promise<MoodDay> {
  return moodDaySchema.parse(await postJson(baseUrl, '/api/wellbeing/mood', { mood }, fetchImpl))
}

/** The caller's mood history, newest-first. */
export async function getMoodHistory(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<readonly MoodDay[]> {
  return z.array(moodDaySchema).parse(await getJson(baseUrl, '/api/wellbeing/mood', fetchImpl))
}

/** Erase the entire mood history in one action (ADR-0071 P3). */
export async function deleteMoodHistory(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await deleteJson(baseUrl, '/api/wellbeing/mood', fetchImpl)
}
