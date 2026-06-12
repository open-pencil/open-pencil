import { expect, test } from '@playwright/test'

import { cleanState } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { expectModal } from '#tests/helpers/interaction'

test.describe('account interaction', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('anonymous user sees the Google login button', async ({ page }) => {
    await page.goto('/account')

    await expect(page.getByTestId('account-view')).toBeVisible()
    await expect(page.getByTestId('account-login-button')).toBeVisible()
    await expect(page.getByTestId('account-profile')).toHaveCount(0)
  })

  test('logged in user sees profile and logout button', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'profile@jfet.co.jp', name: 'Profile User' })
    await page.goto('/account')

    await expect(page.getByTestId('account-profile')).toBeVisible()
    await expect(page.getByTestId('account-name')).toContainText('Profile User')
    await expect(page.getByTestId('account-email')).toContainText('profile@jfet.co.jp')
    await expect(page.getByTestId('account-logout-button')).toBeVisible()
  })

  test('logout dialog cancel keeps the session', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'logout@jfet.co.jp', name: 'Logout User' })
    await page.goto('/account')

    await page.getByTestId('account-logout-button').click()
    await expectModal(page, 'account-logout-dialog', { open: true })

    await page.getByTestId('account-logout-cancel').click()
    await expectModal(page, 'account-logout-dialog', { open: false })
    await expect(page.getByTestId('account-profile')).toBeVisible()
  })
})
