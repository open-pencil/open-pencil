import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('font settings popover is available from typography panel', async ({ page }) => {
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

  await expect(page.locator('[data-test-id="typography-section"]')).toBeVisible()
  await page.locator('[data-test-id="font-settings-trigger"]').click()

  await expect(page.getByText('Access system fonts')).toBeVisible()
  await expect(page.locator('[data-test-id="font-settings-request-access"]')).toBeVisible()
  await expect(page.locator('[data-test-id="font-settings-download-fallbacks"]')).toBeVisible()
  await expect(page.locator('[data-test-id="font-settings-refresh-cache"]')).toBeVisible()
  await expect(page.locator('[data-test-id="font-settings-clear-cache"]')).toBeVisible()
})
