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
  'design-system-navigation-tabs--constrained-labels',
  'design-system-disclosure-collapsible--collapsed',
  'design-system-inputs-preset-number--custom-selected',
  'settings-tool-access-list--mixed-access',
  'settings-mcp-failure-alert--all-reasons'
]

for (const theme of ['light', 'dark']) {
  for (const story of stories) {
    test(`${story} in ${theme}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(`/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`)
      const root = page.locator('#storybook-root')
      // Stories exercise different primitive families, so assert that an
      // interactive control rendered rather than one specific family.
      await expect(
        root
          .getByRole('button')
          .or(root.getByRole('tab'))
          .or(root.getByRole('combobox'))
          .or(root.getByRole('spinbutton'))
          .first()
      ).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      // Keep theme coverage on a composed color matrix, not every story permutation.
      if (story === 'design-system-actions-button--color-matrix') {
        await expect(root).toHaveScreenshot(`${story}-${theme}.png`)
      }
      expect(await root.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
      )
      expect(errors).toEqual([])
    })
  }
}

test('swatch forwards live popover state', async ({ page }) => {
  await page.goto(
    '/iframe.html?id=design-system-paint-fill-swatch--popover-composition&viewMode=story'
  )
  const trigger = page.getByRole('button', { name: 'Fill', exact: true })
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(trigger).toHaveAttribute('data-state', 'open')
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toHaveAttribute('data-state', 'closed')
})

test('action row keyboard focus', async ({ page }) => {
  await page.goto('/iframe.html?id=design-system-lists-action-row--default&viewMode=story')
  const row = page.getByRole('button').first()
  await expect(row).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(row).toBeFocused()
})
