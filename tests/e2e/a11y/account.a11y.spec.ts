import { expect, test } from '@playwright/test'

import { runA11yScan, expectNoCriticalViolations } from '#tests/helpers/a11y'
import { cleanState } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { waitForVisualReady } from '#tests/helpers/visual'

test.describe('account accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('anonymous state has no critical accessibility violations', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByTestId('account-login-button')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page)
    expectNoCriticalViolations(results)
  })

  test('signed-in state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'account-a11y-user@jfet.co.jp',
      name: 'Account A11y User'
    })

    await page.goto('/account')
    await expect(page.getByTestId('account-profile')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page)
    expectNoCriticalViolations(results)
  })
})
