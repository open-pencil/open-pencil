import { expect, test } from '@playwright/test'

for (const theme of ['light', 'dark']) {
  test(`adjacent hovered layer does not overlap selected row in ${theme}`, async ({ page }) => {
    await page.goto(
      `/iframe.html?id=editor-layer-tree--virtualized&viewMode=story&globals=theme:${theme}`
    )
    const selected = page.getByRole('treeitem').nth(0).locator('[data-slot="row"]')
    const next = page.getByRole('treeitem').nth(1).locator('[data-slot="row"]')
    await next.hover()
    await expect(selected).toHaveCSS('height', '24px')
    await expect(selected.locator('[data-slot="label"]')).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(selected.locator('[data-slot="disclosure"]')).toHaveCSS(
      'color',
      'rgb(255, 255, 255)'
    )
    const firstBox = await selected.boundingBox()
    const nextBox = await next.boundingBox()
    if (!firstBox || !nextBox) throw new Error('Layer rows are not visible')
    expect(firstBox.y + firstBox.height).toBeLessThanOrEqual(nextBox.y)
    await expect(page.locator('#storybook-root')).toHaveScreenshot(
      `layer-tree-adjacent-hover-${theme}.png`
    )
  })
}
