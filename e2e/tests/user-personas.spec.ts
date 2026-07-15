import { test, expect } from '@playwright/test'
import { apiSignUp, freshUser, uiSignIn } from './support/fixtures.js'

test.describe('E2E Personas · Light, Normal & Heavy (Burnout) Users', () => {
  test('REQ-028 · Light User - has no shifts and no warnings', async ({ page, request }) => {
    const user = freshUser('light')
    await apiSignUp(request, user)
    await uiSignIn(page, user)

    // Navigate to Work time screen
    await page.goto('/profile/worktime')
    await expect(page.getByText('Work time')).toBeVisible()
    await expect(page.getByText('No shifts this week yet.')).toBeVisible()
    await expect(page.getByText('Not clocked in')).toBeVisible()
  })

  test('REQ-028 · Normal User - has standard compliant shift and no warning badges', async ({ page, request }) => {
    const user = freshUser('normal')
    await apiSignUp(request, user)
    
    // Inject a compliant 8h shift (with 1h break) via API
    const today = new Date().toISOString().slice(0, 10)
    await request.post('/api/worktime/shifts', {
      data: {
        startedAt: `${today}T08:00:00.000Z`,
        endedAt: `${today}T17:00:00.000Z`,
        breakMs: 60 * 60 * 1000, // 1 hour break
        source: 'manual',
      }
    })

    await uiSignIn(page, user)
    await page.goto('/profile/worktime')
    
    // The shift row displays date and gross working time (9h gross - 1h break = 8h net)
    await expect(page.getByText(today)).toBeVisible()
    await expect(page.getByText('8:00 h').first()).toBeVisible()
    await expect(page.getByText('1:00 break')).toBeVisible()
    // No warnings should be visible
    await expect(page.getByText('Break short')).toBeHidden()
  })

  test('REQ-028 · Heavy User (Burnout Candidate) - overbooked shift triggers ArbZG break shortfall warning', async ({ page, request }) => {
    const user = freshUser('heavy')
    await apiSignUp(request, user)
    
    // Inject a non-compliant 9.5h shift (with 0h break) via API
    // Under ArbZG §4, working >9 hours requires at least a 45-minute break.
    const today = new Date().toISOString().slice(0, 10)
    await request.post('/api/worktime/shifts', {
      data: {
        startedAt: `${today}T08:00:00.000Z`,
        endedAt: `${today}T17:30:00.000Z`, // 9.5 hours total
        breakMs: 0, // No break!
        source: 'manual',
      }
    })

    await uiSignIn(page, user)
    await page.goto('/profile/worktime')
    
    // Verify shift details: 9.5h gross, 0 break
    await expect(page.getByText(today)).toBeVisible()
    await expect(page.getByText('9:30 h').first()).toBeVisible()
    
    // Verify break shortfall badge (ArbZG §4 warning)
    // Shortfall: 45 minutes (0:45)
    await expect(page.getByText('Break short 0:45')).toBeVisible()
  })
})
