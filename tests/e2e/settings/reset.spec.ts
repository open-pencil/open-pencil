import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('a changed setting offers Reset to default, which puts the default back', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  await page.getByTestId('settings-section-editor').click()
  const editor = page.getByTestId('settings-editor-panel')
  // Nothing has been changed, so no row offers a reset; the toolbar's own stays its section's.
  await expect(editor.locator('[data-settings-reset]')).toHaveCount(0)

  const zoomSpeed = page.getByTestId('settings-zoom-speed')
  await zoomSpeed.click()
  await page.getByRole('option', { name: '2×' }).click()
  const reset = editor
    .locator('[data-slot=settings-row]')
    .filter({ hasText: 'Zoom speed' })
    .getByRole('button', { name: 'Reset to default' })
  await expect(reset).toHaveCount(1)
  await expect(editor.locator('[data-settings-reset]')).toHaveCount(1)

  await reset.click()
  await expect(zoomSpeed).toContainText('1×')
  await expect(reset).toHaveCount(0)
})

test("a changed switch row's text still works its switch, not Reset", async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  await page.getByTestId('settings-section-editor').click()
  const editor = page.getByTestId('settings-editor-panel')
  const toggle = page.getByTestId('settings-snap-geometry')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')

  const row = editor.locator('[data-slot=settings-row]').filter({ hasText: 'Snap to geometry' })
  await expect(row.getByRole('button', { name: 'Reset to default' })).toHaveCount(1)
  // The label's control is the switch even with Reset shown, so its text works the switch.
  const control = await row
    .locator('label')
    .evaluate((label: HTMLLabelElement) => label.control?.getAttribute('data-test-id'))
  expect(control).toBe('settings-snap-geometry')
  await row.getByText('Snap to geometry', { exact: true }).click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
})
