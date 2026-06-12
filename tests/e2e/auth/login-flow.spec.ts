import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '../../helpers/e2e-auth'

test('login session opens boards view with account link and persists the created board', async ({ page }) => {
  const boardName = `Logged-in ${Date.now()}`
  const userEmail = `login-flow-${Date.now()}@jfet.co.jp`

  // PR #141 で /boards は auth 必須 + anonymous → login migrate UX は廃止された。
  // 本 spec は「ログイン済 user が /boards で board を作成し、 reload しても残る」 のを検証する。
  await mockGoogleLogin(page, { email: userEmail, name: 'Login Flow User' })

  await page.goto('/boards')
  await expect(page.getByTestId('boards-view')).toBeVisible()
  await expect(page.getByTestId('boards-account-link')).toBeVisible()
  // login-banner は anonymous 専用 UI、 auth 済では出ない。
  await expect(page.getByTestId('login-banner')).toHaveCount(0)

  await page.getByTestId('board-create-input').fill(boardName)
  await page.getByTestId('board-create-button').click()
  await expect(page.getByTestId('editor-root')).toBeVisible()

  await page.goto('/account')
  await expect(page.getByTestId('account-view')).toBeVisible()
  await expect(page.getByTestId('account-email')).toContainText(userEmail)

  await page.goto('/boards')
  await expect(page.getByText(boardName)).toBeVisible()

  // anonymous id は使われていない (auth 済のため不要)
  const anonymousId = await page.evaluate(() => window.localStorage.getItem('inkly.anonymous-id'))
  expect(anonymousId).toBeNull()

  await page.reload()
  await expect(page.getByText(boardName)).toBeVisible()
})
