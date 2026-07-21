import { test, expect } from '@playwright/test'
import { apiSignUp, freshUser, seedCatalog, seedEntry, todayUtc, uiSignIn } from './support/fixtures.js'

/**
 * Reports CSV export (REQ-009 timesheet-export story, delivered on the web
 * through the REQ-045 Reports export surface): a seeded project + completed
 * time entry roll up into the Reports window, and "Export CSV" hands the
 * deterministic `reportToCsv` bytes (ADR-0005 — every figure is the core's) to
 * a real browser download. The web platform triggering downloads is exactly
 * what this suite runs, so the spec asserts the Playwright `download` event, a
 * plausible filename, and non-empty content naming the seeded project.
 *
 * Honest scope: the signable work-time PDF/XLSX report (the other half of
 * REQ-009) is server-rendered and covered by the billing/export integration
 * tests; this journey covers the browser-download path end-to-end.
 */

test.describe('acceptance · reports CSV export download', () => {
  test('REQ-009 · a seeded entry exports as a CSV download with real content', async ({
    page,
    request,
  }) => {
    const user = freshUser('export')
    await apiSignUp(request, user)
    const catalog = await seedCatalog(request, { project: 'Export Fixture' })
    // A completed 2h entry booked today (UTC runner) — inside the default Week window.
    await seedEntry(request, {
      startedAt: `${todayUtc()}T09:00:00.000Z`,
      endedAt: `${todayUtc()}T11:00:00.000Z`,
      projectId: catalog.projectId,
      note: 'Timesheet export fixture',
      billable: true,
    })
    await uiSignIn(page, user)

    await test.step('Reports renders the summary for the seeded window', async () => {
      await page.goto('/reports')
      await expect(page.getByText('Where did the time go?').first()).toBeVisible()
    })

    let csv = ''
    await test.step('Export CSV triggers a real browser download', async () => {
      const exportButton = page.getByRole('button', { name: 'Export CSV' })
      // Disabled until the live window's data is loaded — never an empty file.
      await expect(exportButton).toBeEnabled()
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe('mydevtime-reports-week.csv')
      const stream = await download.createReadStream()
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk as Buffer)
      csv = Buffer.concat(chunks).toString('utf8')
    })

    await test.step('the CSV is non-empty and carries the deterministic report', async () => {
      expect(csv.length).toBeGreaterThan(0)
      expect(csv).toContain('myDevTime analytics')
      expect(csv).toContain('Total tracked (h)')
      // The seeded project's tracked time made it into the export.
      expect(csv).toContain(catalog.projectName)
      // The confirmation toast lands, and no error is surfaced.
      await expect(page.getByText('Reports exported as CSV.')).toBeVisible()
    })
  })
})
