import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const theme of ['light', 'dark']) {
  test.describe(`dimension fields in ${theme}`, () => {
    test.use({
      storageState: async ({ baseURL }, use) => {
        if (!baseURL) throw new Error('Dimensions tests require a baseURL')
        await use({
          cookies: [],
          origins: [
            {
              origin: new URL(baseURL).origin,
              localStorage: [{ name: 'open-pencil:theme', value: theme }]
            }
          ]
        })
      }
    })
    test('values and long variable bindings share space with sizing controls', async ({ page }) => {
      await page.goto('/?test')
      await new CanvasHelper(page).waitForInit()
      await page.evaluate(() => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        const id = editor.createShape('FRAME', 0, 0, 12345, 6789)
        editor.select([id])
      })
      const section = page.getByRole('region', { name: 'Layout', exact: true })
      const width = section.locator('[data-property="width"]')
      await expect(width).toContainText('12345')
      await expect(section.locator('[data-property="height"]')).toContainText('6789')
      for (const axis of ['width', 'height']) {
        const value = section
          .locator(`[data-property="${axis}"] [data-slot="value"] > span`)
          .first()
        await expect(value).toBeVisible()
        await expect
          .poll(() => value.evaluate((element) => element.scrollWidth <= element.clientWidth))
          .toBe(true)
      }
      await width.getByRole('button', { name: 'Apply variable' }).click()
      await page
        .getByRole('button', { name: 'Create number variable from 12345', exact: true })
        .click()
      await page
        .getByPlaceholder('Variable name')
        .fill('Dimensions/Content/Maximum comfortable width')
      await page.getByRole('button', { name: 'Create', exact: true }).click()
      await expect(width).toHaveAttribute('data-bound')
      if (theme === 'light') await expect(section).toHaveScreenshot('dimensions-bound-light.png')
      await width.getByRole('combobox', { name: 'Width', exact: true }).click()
      await expect(page.getByRole('option', { name: 'Fixed', exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(width).toHaveAttribute('data-bound')
    })
  })
}
