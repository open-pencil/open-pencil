import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('font settings popover exposes web font access without desktop-only cache actions', async ({
  page
}) => {
  test.setTimeout(30_000)
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
  await page.getByTestId('font-settings-trigger').click()

  await expect(page.getByText('Allow browser access to local fonts')).toBeVisible()
  await expect(page.getByTestId('font-settings-request-access')).toBeVisible()
  // The popover triggers refreshSummary() on open, which disables action buttons.
  // Wait for the busy state to clear before interacting with toggles.
  await expect(page.getByTestId('font-settings-toggle-google-fonts')).toBeEnabled({
    timeout: 20_000
  })
  await expect(page.getByTestId('font-settings-toggle-google-fonts')).toHaveText('Disable')
  // Force click needed — Popover content captures pointer events outside the trigger,
  // which can intercept normal clicks on the toggle button inside the popover body.
  await page.getByTestId('font-settings-toggle-google-fonts').dispatchEvent('click')
  await expect(page.getByTestId('font-settings-toggle-google-fonts')).toHaveText('Enable')
  await expect(page.getByTestId('font-settings-toggle-google-fonts')).toBeEnabled()
  await page.getByTestId('font-settings-toggle-google-fonts').dispatchEvent('click')
  await expect(page.getByTestId('font-settings-toggle-google-fonts')).toHaveText('Disable')
  await expect(page.getByTestId('font-settings-download-fallbacks')).toHaveCount(0)
  await expect(page.getByTestId('font-settings-refresh-cache')).toHaveCount(0)
  await expect(page.getByTestId('font-settings-clear-cache')).toHaveCount(0)
  await expect(page.getByText('Download CJK and Arabic fallbacks')).toHaveCount(0)
})
