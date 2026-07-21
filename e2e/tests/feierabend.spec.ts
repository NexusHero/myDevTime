import { test, expect } from '@playwright/test'
import { apiSignUp, freshUser, seedEntry, todayUtc, uiSignIn } from './support/fixtures.js'

/**
 * The Today "Close the day" (Feierabend) card (REQ-063, design v17 §K5). The
 * card folds two feeds through the deterministic `shutdownSummary` core
 * (ADR-0005): today's **booked entries** (real API, `useTodayEntries`) and the
 * **local auto-tracker reality history** (device-local storage, never
 * uploaded).
 *
 * Honest coverage split — what runs end-to-end in this browser suite:
 *  - the booked-entries half: an empty day is `idle` and hides the card; a day
 *    with entries seeded via the real `POST /api/tracking/entries` shows the
 *    booked figure and the clean-day ritual (both asserted here);
 *  - the local-tracker half (tracked reality > 0, unbooked stretches, the
 *    review drafts) needs auto-tracker history that only exists after on-device
 *    capture, which this stack does not produce — that side is covered by the
 *    `todayShutdown` presenter unit tests and the TodayScreen render tests
 *    (`apps/mobile/src/today/shutdown.test.ts`, ADR-0027), not re-faked here.
 */

test.describe('acceptance · Feierabend / close the day', () => {
  test('REQ-063 · an empty day is idle — the card stays hidden', async ({ page, request }) => {
    const user = freshUser('feier-idle')
    await apiSignUp(request, user)
    await uiSignIn(page, user)

    await page.goto('/today')
    // Anchor on Today being fully up before asserting absence.
    await expect(page.getByRole('button', { name: 'Start', exact: true }).first()).toBeVisible()
    await expect(page.getByText('Close the day')).toHaveCount(0)
  })

  test('REQ-063 · booked entries light the card with the booked figure and the ritual', async ({
    page,
    request,
  }) => {
    const user = freshUser('feier-booked')
    await apiSignUp(request, user)
    // 90 booked minutes today (UTC runner) via the real entries endpoint.
    await seedEntry(request, {
      startedAt: `${todayUtc()}T09:00:00.000Z`,
      endedAt: `${todayUtc()}T10:30:00.000Z`,
      note: 'Morning focus block',
    })
    await uiSignIn(page, user)

    await test.step('the card shows the booked figure from the API feed', async () => {
      await page.goto('/today')
      await expect(page.getByText('Close the day')).toBeVisible()
      await expect(page.getByText('Feierabend', { exact: true })).toBeVisible()
      await expect(page.getByText('Booked', { exact: true })).toBeVisible()
      await expect(page.getByText('1:30 h', { exact: true }).first()).toBeVisible()
    })

    await test.step('with nothing tracked locally the day reads clean', async () => {
      // trackedMs is 0 (no local auto-tracker history in this stack), bookedMs > 0
      // → the deterministic summary is clean, never `review`.
      await expect(
        page.getByText(
          'Everything you tracked is booked — the day is fully accounted for. Feierabend.',
        ),
      ).toBeVisible()
    })

    await test.step('the ritual button closes the card for this session', async () => {
      await page.getByRole('button', { name: 'git commit -m "Feierabend"' }).click()
      await expect(page.getByText('Close the day')).toHaveCount(0)
    })
  })
})
