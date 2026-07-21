import { test, expect, type Page } from '@playwright/test'
import {
  apiSignUp,
  enableMoodConsent,
  freshUser,
  seedMoodSeries,
  uiSignIn,
  type MoodSeed,
} from './support/fixtures.js'

/**
 * Acceptance for Sevi's mood-pattern awareness (REQ-068, ADR-0071), driven through the built
 * web app like the golden-path specs (ADR-0053). The honesty rules under test: the weekday
 * note ("Tuesdays often tense") appears in Reports' Balance area only once a weekday carries
 * enough of the person's own consented moods with a low median — ONE bad day is never a
 * pattern — and without the stored opt-in the mood store is impossible (an honest 409, empty
 * history), so no note can exist anywhere. The runner clock is pinned to UTC + en-US, so the
 * seeded weekdays and the English phrasing are deterministic.
 *
 * The lighter-day (MoodEaseCard) confirm flow is NOT exercised here: the card is standalone
 * and not yet mounted in any screen (it lands in TodayScreen at integration), so the confirm
 * path is fully covered by its render tests instead.
 */

/** The most recent `count` PAST days (before today, UTC) that fall on `weekday` (Sunday 0). */
function pastDaysOnWeekday(weekday: number, count: number): string[] {
  const days: string[] = []
  const cursor = new Date()
  cursor.setUTCDate(cursor.getUTCDate() - 1)
  while (days.length < count) {
    if (cursor.getUTCDay() === weekday) days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return days
}

/** Sign a fresh user up + in; returns nothing — the page carries the session afterwards. */
async function signIn(page: Page, request: Parameters<typeof apiSignUp>[0]): Promise<void> {
  const user = freshUser('sevi-mood')
  await apiSignUp(request, user)
  await uiSignIn(page, user)
}

/** Open Reports and switch to the Balance view (its toggle carries the exact label). */
async function openBalanceView(page: Page): Promise<void> {
  await page.goto('/reports')
  await page.getByText('Balance', { exact: true }).first().click()
  // The Balance card's subtitle marks the view as rendered before we assert on the note.
  await expect(page.getByText('From your own tracked time', { exact: false })).toBeVisible()
}

test.describe('acceptance · sevi mood patterns', () => {
  test('REQ-068 · three tense Tuesdays with consent surface the calm weekday note', async ({
    page,
  }) => {
    await signIn(page, page.request)
    await enableMoodConsent(page.request)
    // Three past Tuesdays (UTC weekday 2) all 'tense' → median 2 ≤ the low-mood line.
    const seeds: MoodSeed[] = pastDaysOnWeekday(2, 3).map(day => ({ day, mood: 'tense' }))
    await seedMoodSeries(page.request, seeds)

    await openBalanceView(page)
    const note = page.getByTestId('mood-pattern-note')
    await expect(note).toBeVisible()
    await expect(note).toHaveText('Tuesdays often tense')
  })

  test('REQ-068 · one bad day is never a pattern — no note from a single tense day', async ({
    page,
  }) => {
    await signIn(page, page.request)
    await enableMoodConsent(page.request)
    await seedMoodSeries(page.request, [
      { day: pastDaysOnWeekday(2, 1)[0]!, mood: 'tense' },
    ])

    await openBalanceView(page)
    await expect(page.getByTestId('mood-pattern-note')).toHaveCount(0)
  })

  test('REQ-068 · without consent the mood store is impossible and no note exists', async ({
    page,
  }) => {
    await signIn(page, page.request)

    // The write path is consent-gated server-side: an honest conflict, not a silent drop.
    const denied = await page.request.post('/api/wellbeing/mood', { data: { mood: 'tense' } })
    expect(denied.status()).toBe(409)

    // The history stays structurally empty…
    const history = await page.request.get('/api/wellbeing/mood')
    expect(history.ok()).toBeTruthy()
    expect(await history.json()).toEqual([])

    // …so the Balance area holds no pattern note anywhere.
    await openBalanceView(page)
    await expect(page.getByTestId('mood-pattern-note')).toHaveCount(0)
  })
})
