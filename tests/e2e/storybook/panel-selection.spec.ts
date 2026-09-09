import { expect, test } from '@playwright/test'

for (const theme of ['light', 'dark']) {
  test(`section header after selection changes in ${theme}`, async ({ page }) => {
    await page.goto(
      `/iframe.html?id=design-system-layout-panel-foundation--selection-transition&viewMode=story&globals=theme:${theme}`
    )
    await page.getByRole('button', { name: 'Switch selection' }).click()
    await expect(page.getByRole('button', { name: 'Remove auto layout' })).toBeVisible()
    await expect(page.locator('#storybook-root')).toHaveScreenshot(`selection-header-${theme}.png`)
    await page.getByRole('button', { name: 'Switch selection' }).click()
    await expect(page.getByRole('button', { name: 'Remove auto layout' })).toHaveCount(0)
  })
}
