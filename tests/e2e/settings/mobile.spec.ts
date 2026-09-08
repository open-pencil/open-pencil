import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const theme of ['light', 'dark']) {
  test(`mobile settings navigation and storage actions in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/?test')
    await new CanvasHelper(page).waitForInit()
    await page.evaluate(async (value) => {
      const path = '/src/app/shell/theme.ts'
      const themeModule = await import(path)
      themeModule.useAppTheme().setTheme(value)
    }, theme)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
    const dialog = page.getByTestId('app-settings-dialog')
    await expect(dialog).toBeVisible()
    const general = dialog.getByRole('tab', { name: 'General', exact: true })
    await general.focus()
    await general.press('ArrowRight')
    await expect(page.getByTestId('settings-section-ai')).toBeFocused()
    await expect(page.getByTestId('settings-ai-panel')).toBeVisible()
    await expect(dialog).toHaveScreenshot(`mobile-settings-models-${theme}.png`)
    await page.getByTestId('settings-section-storage').click()
    await expect(page.getByTestId('settings-storage-panel')).toBeVisible()
    await expect(dialog).toHaveScreenshot(`mobile-settings-storage-${theme}.png`)
  })
}
