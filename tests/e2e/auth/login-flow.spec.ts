import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '../../helpers/e2e-auth'

test('anonymous boards migrate into the signed-in account after login', async ({ page }) => {
  const boardName = `Migrated ${Date.now()}`

  await page.goto('/boards')
  await expect(page.getByTestId('boards-view')).toBeVisible()
  await expect(page.getByTestId('login-banner')).toBeVisible()

  await page.getByTestId('board-create-input').fill(boardName)
  await page.getByTestId('board-create-button').click()

  await expect(page.getByTestId('editor-root')).toBeVisible()
  await page.goBack()
  await expect(page.getByText(boardName)).toBeVisible()

  await page.goto('/account')
  await expect(page.getByTestId('account-view')).toBeVisible()
  await expect(page.getByTestId('account-login-button')).toBeVisible()
  await mockGoogleLogin(page, {
    email: 'playwright-user@inkly.test',
    name: 'Playwright User'
  })
  await page.reload()

  await expect(page.getByTestId('account-profile')).toBeVisible()
  await expect(page.getByTestId('account-email')).toContainText('playwright-user@inkly.test')

  await page.goto('/boards')
  await expect(page.getByTestId('boards-account-link')).toBeVisible()
  await expect(page.getByTestId('login-banner')).toHaveCount(0)
  await expect(page.getByText(boardName)).toBeVisible()

  const anonymousId = await page.evaluate(() => window.localStorage.getItem('inkly.anonymous-id'))
  expect(anonymousId).toBeNull()

  await page.reload()
  await expect(page.getByText(boardName)).toBeVisible()
})
