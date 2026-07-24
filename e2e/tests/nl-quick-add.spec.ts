import { test, expect } from '@playwright/test'
import { apiSignUp, freshUser, uiSignIn } from './support/fixtures.js'

/**
 * Natural-language capture (REQ-013, ADR-0005/0029): type a phrase, the server
 * parses it into a **draft** the user reviews, and only the confirm books a real
 * entry via `POST /api/tracking/entries`.
 *
 * Honest scope: the dedicated `NlQuickAdd` component (REQ-013's original card)
 * is not mounted on any screen — the NL capture surface Today actually ships is
 * **Smart-Add** ("Add anything", REQ-047/ADR-0065), which carries the same
 * contract: deterministic parser first (`packages/domain` `parseEntry`), LLM
 * only as a Stage-2 fallback, and a confirmed draft that books through the same
 * entries route. This spec drives that shipped surface with a clock-range
 * phrase the deterministic Stage 1 fully classifies (`needsAi: false`, per the
 * domain parse tests), so the journey needs **no LLM provider** — the
 * `/api/ai/nl-entry` endpoint itself stays covered by the REQ-013 API
 * integration tests. The phrase pins the times (9:00–9:30 today, UTC runner),
 * so the booked figure asserted after reload is deterministic.
 */

test.describe('acceptance · natural-language quick add', () => {
  test('REQ-013 · a deterministic phrase parses to a draft, confirms, and survives a reload', async ({
    page,
    request,
  }) => {
    const user = freshUser('nl-add')
    await apiSignUp(request, user)
    await uiSignIn(page, user)

    await test.step('Today shows the NL capture field', async () => {
      await page.goto('/planner')
      await expect(page.getByText('Add anything')).toBeVisible()
    })

    await test.step('parse a deterministic clock-range phrase into a draft', async () => {
      // Clock range → Meeting, 09:00–09:30, no LLM (deterministic Stage 1).
      await page.getByPlaceholder('Type an entry…').fill('backlog grooming 9:00-9:30')
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      // The typed draft renders for review — nothing is written yet (ADR-0005).
      await expect(page.getByText('Meeting', { exact: true })).toBeVisible()
      await expect(page.getByText('backlog grooming', { exact: true })).toBeVisible()
      await expect(page.getByText('09:00–09:30 · today')).toBeVisible()
    })

    await test.step('confirming books the entry', async () => {
      await page.getByRole('button', { name: 'Add meeting' }).click()
      await expect(page.getByText('Added.', { exact: true })).toBeVisible()
    })

    await test.step('the entry survives a reload — booked into today', async () => {
      await page.reload()
      // The Feierabend card reads today's booked entries from the real API:
      // exactly the 30 booked minutes the confirmed draft created.
      await expect(page.getByText('Close the day')).toBeVisible()
      await expect(page.getByText('0:30 h', { exact: true }).first()).toBeVisible()
    })
  })
})
