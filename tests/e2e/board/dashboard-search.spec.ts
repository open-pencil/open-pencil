import { expect, test, type Page } from '@playwright/test'

import { mockGoogleLogin } from '#tests/helpers/e2e-auth'

async function createBoard(page: Page, name: string) {
  await page.goto('/boards')
  await page.getByTestId('board-create-input').fill(name)
  await page.getByTestId('board-create-button').click()
  await expect(page.getByTestId('editor-root')).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId('boards-view')).toBeVisible()
}

test('dashboard search filters boards by name case-insensitively', async ({ page }) => {
  const alphaBoard = `Search Alpha ${Date.now()}`
  const betaBoard = `Search Beta ${Date.now()}`
  const userEmail = `search-${Date.now()}@jfet.co.jp`

  // auth guard (PR #141) を通すため mockGoogleLogin で session cookie を焼く。
  await mockGoogleLogin(page, { email: userEmail, name: 'Search User' })

  await createBoard(page, alphaBoard)
  await createBoard(page, betaBoard)

  await page.getByTestId('board-search-input').fill('alpha')
  await expect(page.getByText(alphaBoard)).toBeVisible()
  await expect(page.getByText(betaBoard)).toBeHidden()

  await page.getByTestId('board-search-input').fill('BETA')
  await expect(page.getByText(betaBoard)).toBeVisible()
  await expect(page.getByText(alphaBoard)).toBeHidden()
})
