import { expect, test } from '@playwright/test'

const stories = [
  'design-system-inputs-input--default',
  'editor-mobile-hud-actions--default',
  'design-system-actions-button--color-matrix',
  'design-system-actions-button--constrained-labels',
  'editor-toolbar--default',
  'editor-properties-layout-alignment--default',
  'home-document-entry--default',
  'home-document-entry--list',
  'home-document-entry--long-name',
  'home-document-entry--disabled',
  'design-system-lists-action-row--default',
  'design-system-paint-fill-swatch--default',
  'design-system-paint-fill-swatch--transparent',
  'design-system-paint-fill-swatch--gradient',
  'design-system-paint-fill-swatch--image-placeholder',
  'design-system-navigation-tabs--constrained-labels'
]

for (const theme of ['light', 'dark']) {
  for (const story of stories) {
    test(`${story} in ${theme}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(`/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`)
      const root = page.locator('#storybook-root')
      await expect(root.getByRole('button').or(root.getByRole('tab')).first()).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(root).toHaveScreenshot(`${story}-${theme}.png`)
      expect(errors).toEqual([])
    })
  }
}

test('action row keyboard focus', async ({ page }) => {
  await page.goto('/iframe.html?id=design-system-lists-action-row--default&viewMode=story')
  const row = page.getByRole('button').first()
  await expect(row).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(row).toBeFocused()
  await expect(page.locator('#storybook-root')).toHaveScreenshot('action-row-keyboard-focus.png')
})
