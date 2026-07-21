import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { apiSignUp, freshUser, uiSignIn } from './support/fixtures.js'

/**
 * Calm canvas + Sevi first run (REQ-074, ADR-0072 D3), driven through the built web app
 * against the real stack (ADR-0053). Two journeys, both proving persisted server state —
 * never a stub:
 *
 *  1. **Empty-planner first run** — a truly empty planner is Sevi's stage: three questions
 *     build the first ghost week, one tap applies it through the plan-apply seam (provenance
 *     `planner-firstrun`). The applied plan is read back from `GET /api/planner/plans` (a real
 *     accepted version with blocks), and — the binding REQ-074 rule — the stage never returns:
 *     after a full reload the questions are gone (the seen/accepted flag persisted per user).
 *
 *  2. **Layer chip** — Ruhe als Default: the week opens with only the accepted plan + now-line;
 *     every extra layer is one explicit chip tap, persisted per user. Opening the Capacity layer
 *     surfaces the head-trace, and the chip's ON state (and its visible consequence) survive a
 *     full reload — the preferences-backed persistence the calm canvas relies on.
 */

/** Sign a fresh user up via the API, then in through the real UI. */
async function signIn(page: Page, request: APIRequestContext, prefix: string): Promise<void> {
  const user = freshUser(prefix)
  await apiSignUp(request, user)
  await uiSignIn(page, user)
}

/** This-week and next-week Mon–Fri `YYYY-MM-DD` keys (UTC — the runner's pinned zone). */
function candidatePlanDates(): string[] {
  const now = new Date()
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7))
  monday.setUTCHours(0, 0, 0, 0)
  const out: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    const dow = d.getUTCDay()
    if (dow >= 1 && dow <= 5) out.push(d.toISOString().slice(0, 10))
  }
  return out
}

test.describe('acceptance · calm canvas + Sevi first run (REQ-074)', () => {
  test('empty planner → Sevi questions → accept → plan persisted + never shown again', async ({
    page,
    request,
  }) => {
    await signIn(page, request, 'firstrun')

    await test.step('the empty planner is Sevi’s stage, not a dead wall', async () => {
      await page.goto('/planner')
      await expect(page.getByText('Deine Woche ist noch leer.')).toBeVisible()
      // The two/three questions are on stage (REQ-074) — no demo blocks anywhere.
      await expect(page.getByText('Wann fängst du an?')).toBeVisible()
      await expect(page.getByText('Wann ist Feierabend?')).toBeVisible()
    })

    await test.step('answer, then accept the first ghost week in one tap', async () => {
      await page.getByLabel('Woran arbeitest du diese Woche?').fill('Sync-Engine')
      // The accept label reads "Woche übernehmen" (or "Nächste Woche…" on a weekend).
      await page.getByRole('button', { name: /übernehmen$/ }).click()
      // The stage leaves once the plan is applied through the seam.
      await expect(page.getByText('Wann fängst du an?')).toBeHidden()
    })

    await test.step('the accepted plan is real, persisted server state', async () => {
      let found = false
      for (const date of candidatePlanDates()) {
        const res = await page.request.get(`/api/planner/plans?date=${date}`)
        expect(res.ok()).toBeTruthy()
        const body = (await res.text()).trim()
        if (body === '' || body === 'null') continue
        const plan = JSON.parse(body) as { status: string; blocks: unknown[] }
        if (plan.status === 'accepted' && plan.blocks.length > 0) {
          found = true
          break
        }
      }
      expect(found, 'an accepted first-run plan with blocks was persisted').toBeTruthy()
    })

    await test.step('after a full reload the stage never returns (flag persisted)', async () => {
      await page.reload()
      await expect(page.getByRole('button', { name: '+ New' })).toBeVisible()
      await expect(page.getByText('Deine Woche ist noch leer.')).toHaveCount(0)
      await expect(page.getByText('Wann fängst du an?')).toHaveCount(0)
    })
  })

  test('calm default → open a layer chip → the chip state survives a reload', async ({
    page,
    request,
  }) => {
    await signIn(page, request, 'layerchip')
    // Mark first-run done so the empty-planner stage doesn't cover the week canvas —
    // this journey is about the chips, not the first run.
    const seen = await page.request.put('/api/preferences', {
      data: { plannerFirstRunDone: true },
    })
    expect(seen.ok()).toBeTruthy()

    await test.step('the week opens calm — the Capacity head-trace is not shown', async () => {
      await page.goto('/planner')
      await page.getByRole('button', { name: 'Week', exact: true }).click()
      // The layer-chip row is the calm default's signature.
      await expect(page.getByRole('button', { name: 'Capacity layer' })).toBeVisible()
      // Ruhe als Default: the capacity trace lives behind its chip, closed.
      await expect(page.getByText('Plannable this week')).toHaveCount(0)
    })

    await test.step('one tap opens the Capacity layer', async () => {
      await page.getByRole('button', { name: 'Capacity layer' }).click()
      await expect(page.getByText('Plannable this week')).toBeVisible()
    })

    await test.step('the chip state persists across a full reload (preferences)', async () => {
      await page.reload()
      await page.getByRole('button', { name: 'Week', exact: true }).click()
      // The layer stayed open — the tap was persisted per user, not local UI state.
      await expect(page.getByText('Plannable this week')).toBeVisible()
    })
  })
})
