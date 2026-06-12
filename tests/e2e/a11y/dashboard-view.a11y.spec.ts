import { expect, test } from '@playwright/test'

import { runA11yScan, expectNoCriticalViolations } from '#tests/helpers/a11y'
import { cleanState, seedBoards } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { waitForVisualReady } from '#tests/helpers/visual'

const dashboardViewDisabledRules = [
  // TODO(cardene): contrast on accent CTA / metric cards follow-up
  'color-contrast'
]

test.describe('dashboard view accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('anonymous state has no critical accessibility violations', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByTestId('dashboard-view')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: dashboardViewDisabledRules
    })
    expectNoCriticalViolations(results)
  })

  test('populated state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'dashboard-view-a11y-populated@jfet.co.jp',
      name: 'Dashboard View A11y Populated'
    })
    await seedBoards(page, 3)

    await page.goto('/dashboard')
    await expect(page.getByTestId('dashboard-recent-list')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: dashboardViewDisabledRules
    })
    expectNoCriticalViolations(results)
  })
})
