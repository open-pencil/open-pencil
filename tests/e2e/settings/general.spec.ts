import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('language can be changed from General settings and persists', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-language').click()
  await page.getByRole('option', { name: 'Русский' }).click()
  await expect(page.getByTestId('app-settings-dialog')).toContainText('Настройки')

  await page.getByTestId('settings-language').click()
  await page.getByRole('option', { name: 'English' }).click()
  await expect(page.getByTestId('app-settings-dialog')).toContainText('Settings')

  await page.reload()
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await expect(page.getByTestId('settings-language')).toContainText('English')
})

test('general snapping preferences persist and apply to editor sessions', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByTestId('app-settings-trigger').click()
  await expect(page.getByTestId('settings-general-panel')).toBeVisible()
  const geometry = page.getByRole('switch', { name: 'Snap to geometry' })
  const objects = page.getByRole('switch', { name: 'Snap to objects' })
  const pixelGrid = page.getByRole('switch', { name: 'Snap to pixel grid' })
  await expect(geometry).toBeChecked()
  await expect(objects).toBeChecked()
  await expect(pixelGrid).toBeChecked()

  await geometry.click()
  await objects.click()
  await pixelGrid.click()
  await expect
    .poll(() =>
      page.evaluate(() => window.openPencil?.getStore?.().state.snappingPreferences ?? null)
    )
    .toEqual({ geometry: false, objects: false, pixelGrid: false })

  await page.getByTestId('app-settings-done').click()
  await page.reload()
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await expect(geometry).not.toBeChecked()
  await expect(objects).not.toBeChecked()
  await expect(pixelGrid).not.toBeChecked()
  await expect(
    page.evaluate(() => window.openPencil?.getStore?.().state.snappingPreferences ?? null)
  ).resolves.toEqual({ geometry: false, objects: false, pixelGrid: false })

  await geometry.click()
  await objects.click()
  await pixelGrid.click()
})

test('Preferences menu snapping controls use the same preferences', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByTestId('menubar-view').click()
  await page.getByRole('menuitem', { name: 'Preferences' }).hover()
  const geometry = page.getByRole('menuitemcheckbox', { name: 'Snap to geometry' })
  const objects = page.getByRole('menuitemcheckbox', { name: 'Snap to objects' })
  const pixelGrid = page.getByRole('menuitemcheckbox', { name: 'Snap to pixel grid' })
  await expect(geometry).toBeChecked()
  await expect(objects).toBeChecked()
  await expect(pixelGrid).toBeChecked()
  await objects.click()

  await page.getByTestId('app-settings-trigger').click()
  await expect(page.getByRole('switch', { name: 'Snap to objects' })).not.toBeChecked()
  await page.getByRole('switch', { name: 'Snap to objects' }).click()
})

test('settings shortcut preserves the last visited section', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-media').click()
  await page.getByTestId('app-settings-done').click()

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  await expect(page.getByTestId('settings-media-panel')).toBeVisible()
})
