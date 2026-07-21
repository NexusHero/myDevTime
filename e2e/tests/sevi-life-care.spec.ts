import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import {
  apiSignUp,
  enableSevi,
  freshUser,
  seedEveningWork,
  uiSignIn,
  utcDayKey,
} from './support/fixtures.js'

/**
 * Acceptance: Sevi life care (REQ-071, ADR-0071 P5). The calm life-care voices on the Planner
 * week — surfaced only from real persisted state (the recurrence feed the canvas reads), each
 * with ONE explicit confirm that books a real 🛡 protect-time window, and every voice gated
 * through the same nudge policy as the rest of Sevi (an active protected window silences all
 * of them). Selectors are accessibility-first: each voice is a `status` region whose
 * accessible name carries the message.
 *
 * NOTE — rest-day positive path: the `consecutive-heavy-days` signal is derived from the
 * wellbeing load-history series, which is written ONLY by the evening-companion day-review
 * path and always keyed to the server's own "today" — there is no public endpoint that can
 * seed N past heavy days for a fresh user. The positive rest-day journey is therefore covered
 * by the unit suite (`useLifeCare.test.tsx`, `lifeCare.test.ts`); here we assert the honest
 * E2E negative: a normal week never shows the rest-day voice. This is a seeding boundary,
 * not a skipped behaviour.
 */

/** Sign up + opt into Sevi, sign in, and open the Planner's Week view. */
async function openPlannerWeek(
  page: Page,
  request: APIRequestContext,
  prefix: string,
): Promise<void> {
  const user = freshUser(prefix)
  await apiSignUp(request, user)
  await enableSevi(request)
  await uiSignIn(page, user)
  await page.goto('/planner')
  // The Planner opens on Day — the life-care card lives on the week canvas.
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await expect(page.getByPlaceholder('Ask about your week…')).toBeVisible()
}

/** Any life-care voice row (the three messages are the closed vocabulary of REQ-071). */
function lifeCareVoices(page: Page) {
  return page.getByRole('status', {
    name: /no free evening|Work overlaps|tomorrow evening could stay free/i,
  })
}

test.describe('acceptance · sevi life care (REQ-071)', () => {
  test('every evening booked → the protect-an-evening voice appears and a confirm persists a protected time', async ({
    page,
    request,
  }) => {
    await test.step('seed a week whose every evening carries work', async () => {
      const user = freshUser('lifecare-full')
      await apiSignUp(request, user)
      await seedEveningWork(request, { evenings: 7 })
      await enableSevi(request)
      await uiSignIn(page, user)
      await page.goto('/planner')
      await page.getByRole('button', { name: 'Week', exact: true }).click()
    })

    await test.step('the voice speaks, calm and named', async () => {
      await expect(
        page.getByRole('status', { name: /no free evening/i }),
      ).toBeVisible()
    })

    await test.step('one explicit confirm books the protected evening', async () => {
      await page.getByRole('button', { name: 'Protect an evening?' }).click()
      // The row collapses into its done-line — no second confirm to double-post.
      await expect(page.getByText('Protected.')).toBeVisible()
    })

    await test.step('the protected time really persists (survives a reload)', async () => {
      await page.reload()
      await expect(page.getByPlaceholder('you@company.com')).toBeHidden()
      // All evenings are equally booked, so the deterministic pick is today, 18:00–22:00.
      const res = await request.get(`/api/planner/protected?day=${utcDayKey()}`)
      expect(res.ok(), `GET protected failed (${String(res.status())})`).toBeTruthy()
      const windows = (await res.json()) as { startMin: number; endMin: number }[]
      expect(windows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ startMin: 18 * 60, endMin: 22 * 60 }),
        ]),
      )
    })
  })

  test('a week with free evenings → the voice stays hidden', async ({ page, request }) => {
    await test.step('seed only two booked evenings', async () => {
      const user = freshUser('lifecare-free')
      await apiSignUp(request, user)
      await seedEveningWork(request, { evenings: 2 })
      await enableSevi(request)
      await uiSignIn(page, user)
      await page.goto('/planner')
      await page.getByRole('button', { name: 'Week', exact: true }).click()
    })

    await test.step('the canvas shows the seeded work, but no voice', async () => {
      // The seeded occurrence rendering proves the recurrence feed resolved — the
      // life-care derivation has decided by then, so the negative below is real.
      await expect(page.getByText('Late focus').first()).toBeVisible()
      await expect(page.getByRole('status', { name: /no free evening/i })).toHaveCount(0)
    })
  })

  test('an active protect-time right now silences every life-care voice (policy honoured)', async ({
    page,
    request,
  }) => {
    await test.step('seed a full week AND an all-day protected window covering now', async () => {
      const user = freshUser('lifecare-shield')
      await apiSignUp(request, user)
      await seedEveningWork(request, { evenings: 7 })
      await enableSevi(request)
      const res = await request.post('/api/planner/apply', {
        data: {
          proposal: { kind: 'protect-time', day: utcDayKey(), startMin: 0, endMin: 1440 },
        },
      })
      expect(res.ok(), `protect-time seed failed (${String(res.status())})`).toBeTruthy()
      await uiSignIn(page, user)
      await page.goto('/planner')
      await page.getByRole('button', { name: 'Week', exact: true }).click()
    })

    await test.step('the week is fully booked, yet Sevi holds every voice', async () => {
      await expect(page.getByText('Late focus').first()).toBeVisible()
      await expect(lifeCareVoices(page)).toHaveCount(0)
    })
  })

  test('a normal week never shows the rest-day voice (see the seeding note above)', async ({
    page,
    request,
  }) => {
    await openPlannerWeek(page, request, 'lifecare-rest')
    await expect(page.getByRole('status', { name: /tomorrow evening could stay free/i })).toHaveCount(
      0,
    )
  })
})
