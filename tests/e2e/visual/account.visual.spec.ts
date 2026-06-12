import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { cleanState } from '#tests/helpers/api-seed'
import { expectPageScreenshot } from '#tests/helpers/visual'

test.describe('account visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('logged out state', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByTestId('account-login-button')).toBeVisible()
    await expectPageScreenshot(page, 'account-logged-out.png')
  })

  test('logged in state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'account-user@jfet.co.jp',
      name: 'Account User'
    })

    await page.goto('/account')
    await expect(page.getByTestId('account-profile')).toBeVisible()
    await expectPageScreenshot(page, 'account-logged-in.png')
  })
})
