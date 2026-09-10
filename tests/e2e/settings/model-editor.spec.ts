import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('model editing keeps the Settings shell stable and isolates the form', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-ai').click()
  const dialog = page.getByTestId('app-settings-dialog')
  await expect(dialog).toBeVisible()
  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished))
  })
  const before = await dialog.boundingBox()
  await page.getByTestId('settings-add-model').click()
  const editor = page.getByTestId('settings-model-editor')
  await expect(editor).toBeVisible()
  await expect(dialog.getByText('Chat', { exact: true })).not.toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
  await expect(page.getByTestId('app-settings-done')).toHaveCount(0)
  expect(await dialog.boundingBox()).toEqual(before)

  // Accidental dismissal must not throw away an in-progress profile.
  await page.keyboard.press('Escape')
  await expect(editor).toBeVisible()
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await expect(page.getByTestId('app-settings-done')).toBeVisible()
  expect(await dialog.boundingBox()).toEqual(before)
})

test('page rows keep the same compact height while renaming', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const row = page.getByTestId('pages-row').first()
  await expect(row).toHaveCSS('height', '24px')
  await row.getByRole('button').dblclick()
  await expect(page.getByTestId('pages-item-input')).toBeVisible()
  await expect(row).toHaveCSS('height', '24px')
  await page.getByTestId('pages-item-input').press('Escape')
  await expect(row).toHaveCSS('height', '24px')
})
