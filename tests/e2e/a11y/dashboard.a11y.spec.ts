import { expect, test } from '@playwright/test'

import { runA11yScan, expectNoCriticalViolations } from '#tests/helpers/a11y'
import { cleanState, seedBoards } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { waitForVisualReady } from '#tests/helpers/visual'

const dashboardDisabledRules = [
  // TODO(cardene): `color-contrast` on dashboard CTA controls is tracked for a follow-up a11y fix PR.
  'color-contrast'
]

test.describe('dashboard accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('empty state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'dashboard-a11y-empty@jfet.co.jp',
      name: 'Dashboard A11y Empty'
    })

    await page.goto('/boards')
    await expect(page.getByTestId('boards-view')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: dashboardDisabledRules
    })
    expectNoCriticalViolations(results)
  })

  test('populated state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'dashboard-a11y-populated@jfet.co.jp',
      name: 'Dashboard A11y Populated'
    })
    await seedBoards(page, 3)

    await page.goto('/boards')
    await expect(page.getByTestId('board-card')).toHaveCount(3)
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: dashboardDisabledRules
    })
    expectNoCriticalViolations(results)
  })
})
