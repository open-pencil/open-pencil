import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('dashboard shows a cached preview thumbnail after editing a board', async ({ page }) => {
  const boardName = `Preview ${Date.now()}`

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
