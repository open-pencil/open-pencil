import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '#tests/helpers/e2e-auth'

test('dashboard shows boards and opens a newly created board in the editor', async ({ page }) => {
  const boardName = `Dashboard ${Date.now()}`
  const userEmail = `dashboard-${Date.now()}@jfet.co.jp`

  // PR #141 で auth guard が入り `/boards` はログイン必須になったため、 mockGoogleLogin で
  // session cookie を焼いてから /boards を開く。
  await mockGoogleLogin(page, { email: userEmail, name: 'Dashboard User' })
  await page.goto('/boards')
  await expect(page.getByTestId('boards-view')).toBeVisible()

  await page.getByTestId('board-create-input').fill(boardName)
  await page.getByTestId('board-create-button').click()

  await expect(page.getByTestId('editor-root')).toBeVisible()
  await expect(page).toHaveURL(/\/board\//)

  await page.goBack()
  await expect(page.getByTestId('boards-view')).toBeVisible()
  await expect(page.getByText(boardName)).toBeVisible()
})
