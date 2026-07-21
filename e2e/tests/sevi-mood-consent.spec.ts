import { test, expect, type Page } from '@playwright/test'
import {
  apiSignUp,
  deleteMoodHistoryViaApi,
  freshUser,
  readMoodHistory,
  setSeviPrefs,
  uiSignIn,
} from './support/fixtures.js'

/**
 * Acceptance for consented mood capture (ADR-0071 P3, REQ-068): the punch-out
 * MoodCheck's word is stored ONLY under the explicit `moodConsent` preference —
 * with consent off the client never even calls the API (the server's 409 stays
 * the backstop), with consent on the word lands keyed to today, one DELETE wipes
 * the whole history, and one user's moods are invisible to another (workspace
 * isolation). The punch-out flow is driven through the real hero tracker UI,
 * exactly like the tracking golden path.
 */

/** The Today hero tracker's punch button — labeled `Start` idle, `Stop` while active. */
function punchButton(page: Page, state: 'Start' | 'Stop') {
  return page.getByRole('button', { name: state, exact: true }).first()
}

/**
 * Track a moment and punch out so the transient MoodCheck row appears, then tap a
 * mood word. Mirrors the golden path's deterministic waits (clock tick, enabled
 * gate, forced click past the LiveButton breathing).
 */
async function punchOutAndPickMood(page: Page, mood: 'Good' | 'Tense' | 'Stressed'): Promise<void> {
  await page.goto('/today')
  await punchButton(page, 'Start').click()
  const clock = page.getByRole('timer')
  await expect(clock).toBeVisible()
  await expect(clock).not.toHaveText('00:00:00')
  const stop = punchButton(page, 'Stop')
  await expect(stop).toBeEnabled()
  await stop.click({ force: true })
  await expect(page.getByText(/Timer stopped/)).toBeVisible()
  // The punch-out moment: the one-tap mood row (never a standing widget).
  await page.getByRole('button', { name: mood, exact: true }).click()
  // Its quiet acknowledgement — after this any consented POST has been sent.
  await expect(page.getByText('Noted.')).toBeVisible()
}

test.describe('acceptance · sevi mood consent', () => {
  test('REQ-068 · consent OFF: a tapped mood never reaches the server', async ({
    page,
    request,
  }) => {
    const user = freshUser('mood-off')
    await apiSignUp(request, user)
    await uiSignIn(page, user)
    // moodConsent defaults to false — pin it anyway so the spec states its premise.
    await setSeviPrefs(request, { moodConsent: false })
    await punchOutAndPickMood(page, 'Tense')
    expect(await readMoodHistory(request)).toHaveLength(0)
  })

  test('REQ-068 · consent ON: the word lands keyed to today, and one DELETE wipes it', async ({
    page,
    request,
  }) => {
    const user = freshUser('mood-on')
    await apiSignUp(request, user)
    await uiSignIn(page, user)
    await setSeviPrefs(request, { moodConsent: true })
    await punchOutAndPickMood(page, 'Tense')

    // The consented word is stored, keyed to today (browser + assertions both UTC).
    await expect
      .poll(async () => await readMoodHistory(request), { timeout: 10_000 })
      .toHaveLength(1)
    const [entry] = await readMoodHistory(request)
    expect(entry?.mood).toBe('tense')
    expect(entry?.day).toBe(new Date().toISOString().slice(0, 10))

    // Deletable memory, one action (GDPR): a single DELETE erases the history.
    await deleteMoodHistoryViaApi(request)
    expect(await readMoodHistory(request)).toHaveLength(0)
  })

  test('REQ-068 · isolation: a second user never sees the first user\'s moods', async ({
    page,
    request,
    browser,
  }) => {
    // User A stores a mood with consent.
    const userA = freshUser('mood-a')
    await apiSignUp(request, userA)
    await uiSignIn(page, userA)
    await setSeviPrefs(request, { moodConsent: true })
    await punchOutAndPickMood(page, 'Stressed')
    await expect
      .poll(async () => await readMoodHistory(request), { timeout: 10_000 })
      .toHaveLength(1)

    // A brand-new user in a separate context (own cookie jar) sees an empty history.
    const contextB = await browser.newContext()
    try {
      const userB = freshUser('mood-b')
      await apiSignUp(contextB.request, userB)
      expect(await readMoodHistory(contextB.request)).toHaveLength(0)
    } finally {
      await contextB.close()
    }
  })
})
