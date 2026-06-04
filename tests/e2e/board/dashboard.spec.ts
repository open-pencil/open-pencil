import { expect, test } from '@playwright/test'

test('dashboard shows boards and opens a newly created board in the editor', async ({ page }) => {
  const boardName = `Dashboard ${Date.now()}`

  await page.goto('/boards')
  await expect(page.getByTestId('boards-view')).toBeVisible()

  await page.getByTestId('board-create-input').fill(boardName)
  await page.getByTestId('board-create-button').click()

  await expect(page.getByTestId('editor-root')).toBeVisible()
  await expect(page).toHaveURL(/\/\?board=/)

  await page.goBack()
  await expect(page.getByTestId('boards-view')).toBeVisible()
  await expect(page.getByText(boardName)).toBeVisible()
})
