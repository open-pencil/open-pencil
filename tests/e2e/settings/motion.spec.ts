import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const appearance of [undefined, null, { animations: 'invalid' }]) {
  test.describe(`legacy animation preferences ${JSON.stringify(appearance)}`, () => {
    test.use({
      storageState: async ({ baseURL }, use) => {
        if (!baseURL) throw new Error('Browser test baseURL is required')
        await use({
          cookies: [],
          origins: [
            {
              origin: new URL(baseURL).origin,
              localStorage: [
                {
                  name: 'open-pencil:preferences:v1',
                  value: JSON.stringify({ version: 1, appearance })
                }
              ]
            }
          ]
        })
      }
    })
    test('normalizes the preference', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto('/?test')
      await new CanvasHelper(page).waitForInit()
      await expect(page.locator('html')).toHaveAttribute('data-motion', 'full')
    })
  })
}

test('animation preference follows live system changes and persists the Off override', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByTestId('app-settings-trigger').click()
  await page.getByRole('combobox', { name: 'Animations', exact: true }).click()
  await page.getByRole('option', { name: 'Off', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off')
  await expect(page.getByTestId('app-settings-dialog')).toHaveCSS('animation-name', 'none')
  await page.reload()
  await new CanvasHelper(page).waitForInit()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off')
  await page.getByTestId('app-settings-trigger').click()
  await page.getByRole('combobox', { name: 'Animations', exact: true }).click()
  await page.getByRole('option', { name: 'Follow system', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full')
})
