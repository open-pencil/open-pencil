import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('font settings popover exposes web font access without desktop-only cache actions', async ({
  page
}) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('TEXT', 120, 120, 240, 40)
    store.updateNode(id, { characters: 'Font settings smoke' })
    store.select([id])
  })

  await expect(page.getByTestId('typography-section')).toBeVisible()
  const fontSettings = page.getByTestId('font-settings-trigger')
  await fontSettings.hover()
  await expect(page.locator('[role=tooltip]').filter({ hasText: 'Font settings' })).toBeVisible()
  await fontSettings.click()
  await expect(page.locator('[role=tooltip]').filter({ hasText: 'Font settings' })).toHaveCount(0)

  await expect(page.getByText('Allow browser access to local fonts')).toBeVisible()
  await expect(page.getByTestId('font-settings-request-access')).toBeVisible()
  await expect(page.getByTestId('font-settings-toggle-google-fonts')).toHaveText('Disable')
  await page.getByTestId('font-settings-toggle-google-fonts').click()
  await expect(page.getByTestId('font-settings-toggle-google-fonts')).toHaveText('Enable')
  await page.getByTestId('font-settings-toggle-google-fonts').click()
  await expect(page.getByTestId('font-settings-toggle-google-fonts')).toHaveText('Disable')
  await expect(page.getByTestId('font-settings-download-fallbacks')).toHaveCount(0)
  await expect(page.getByTestId('font-settings-refresh-cache')).toHaveCount(0)
  await expect(page.getByTestId('font-settings-clear-cache')).toHaveCount(0)
  await expect(page.getByText('Download CJK and Arabic fallbacks')).toHaveCount(0)
})
