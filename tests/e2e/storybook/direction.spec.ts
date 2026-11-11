import { expect, test } from '@playwright/test'

/**
 * Stories in a mirrored interface, as Arabic shows them: lists and panels read right to left,
 * while numbers, alignment, and other things that describe the canvas stay left to right.
 */
const stories = [
  ['app-editor-layer-tree--virtualized', 'layer-tree'],
  ['app-editor-properties-layout-alignment--default', 'layout-alignment'],
  ['design-system-inputs-preset-number--custom-selected', 'number-field'],
  ['design-system-inputs-range-calendar--selected', 'range-calendar'],
  ['app-home-document-entry--list-with-menu', 'document-entry']
] as const

for (const [id, name] of stories) {
  test(`${name} mirrored`, async ({ page }) => {
    await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:dark;direction:rtl`)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('#storybook-root')).toHaveScreenshot(`${name}-rtl.png`)
  })
}
