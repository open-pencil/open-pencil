import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'

test('dashboard shows a cached preview thumbnail after editing a board', async ({ page }) => {
  const boardName = `Preview ${Date.now()}`
  const userEmail = `preview-${Date.now()}@jfet.co.jp`

  // auth guard (PR #141) を通すため mockGoogleLogin で session cookie を焼く。
  await mockGoogleLogin(page, { email: userEmail, name: 'Preview User' })

  await page.goto('/boards')
  await page.getByTestId('board-create-input').fill(boardName)
  await page.getByTestId('board-create-button').click()
  await expect(page.getByTestId('editor-root')).toBeVisible()

  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.drawRect(100, 100, 140, 100)

  await page.goBack()
  await expect(page.getByTestId('boards-view')).toBeVisible()

  const card = page.getByTestId('board-card').filter({ has: page.getByText(boardName) })
  await expect(card.getByTestId('board-preview-image')).toBeVisible()
})
