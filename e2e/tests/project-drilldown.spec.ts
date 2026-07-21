import { test, expect } from '@playwright/test'
import { apiSignUp, freshUser, seedCatalog, uiSignIn } from './support/fixtures.js'

/**
 * Projects drill-down (REQ-001 catalog + ux-vision §3): a client → project →
 * task tree seeded through the real tracking endpoints
 * (`POST /api/tracking/{clients,projects,tasks}`) renders on the Projects list,
 * a tap opens the Project detail (`/projects/:id`), and a task row opens the
 * Task detail (`/tasks/:id`) with its honest empty entry history. All
 * navigation flows through real URLs (the design nav model, ADR-0045). A fresh
 * user, by contrast, sees the honest empty state — the app fabricates no rows.
 */

test.describe('acceptance · projects drill-down', () => {
  test('REQ-001 · seeded catalog: Projects list → Project detail → Task detail', async ({
    page,
    request,
  }) => {
    const user = freshUser('drill')
    await apiSignUp(request, user)
    // Seed through the API session `apiSignUp` left on the standalone request context.
    const catalog = await seedCatalog(request)
    await uiSignIn(page, user)

    await test.step('the seeded project renders on the Projects list', async () => {
      await page.goto('/projects')
      await expect(
        page.getByRole('button', { name: `Open ${catalog.projectName}` }),
      ).toBeVisible()
    })

    await test.step('tapping the project opens the Project detail', async () => {
      await page.getByRole('button', { name: `Open ${catalog.projectName}` }).click()
      await expect(page).toHaveURL(new RegExp(`/projects/${catalog.projectId}$`))
      // Drill-down header: project title over its client, plus the task breakdown.
      await expect(page.getByText(catalog.projectName, { exact: true }).first()).toBeVisible()
      await expect(page.getByText(catalog.clientName, { exact: true }).first()).toBeVisible()
      await expect(page.getByText('Tasks · 1')).toBeVisible()
    })

    await test.step('tapping the task opens the Task detail', async () => {
      await page.getByRole('button', { name: catalog.taskName }).click()
      await expect(page).toHaveURL(new RegExp(`/tasks/${catalog.taskId}$`))
      await expect(page.getByText(`${catalog.clientName} · ${catalog.projectName}`)).toBeVisible()
      await expect(page.getByText('Recent entries')).toBeVisible()
      // Honest empty history — nothing has been tracked on this task yet.
      await expect(page.getByText('No time entries for this task yet.')).toBeVisible()
    })
  })

  test('REQ-001 · a fresh user sees the honest empty state on Projects', async ({
    page,
    request,
  }) => {
    const user = freshUser('drill-empty')
    await apiSignUp(request, user)
    await uiSignIn(page, user)

    await page.goto('/projects')
    await expect(page.getByText('No projects yet')).toBeVisible()
    await expect(page.getByText('Create a client and project to start tracking.')).toBeVisible()
  })
})
