import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const type of ['TEXT', 'RECTANGLE', 'FRAME'] as const) {
  test(`${type} layout uses one appropriate sizing heading`, async ({ page }) => {
    await page.goto('/?test')
    await new CanvasHelper(page).waitForInit()
    await page.evaluate((type) => {
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      const id = editor.createShape(type, 100, 100, 240, 80)
      if (type === 'TEXT') editor.updateNode(id, { text: 'Sizing', fontSize: 24 })
      editor.select([id])
    }, type)
    const layout = page.getByRole('region', { name: 'Layout', exact: true })
    await expect(layout.getByText('Dimensions', { exact: true })).toHaveCount(
      type === 'TEXT' ? 0 : 1
    )
    await expect(layout.getByText('Resizing', { exact: true })).toHaveCount(type === 'TEXT' ? 1 : 0)
    await expect(layout).toHaveScreenshot(`layout-${type.toLowerCase()}.png`)
  })
}

test('missing paint styles stay visible and detachable', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const id = editor.createShape('RECTANGLE', 100, 100, 240, 80)
    editor.updateNode(id, { fillStyleId: 'missing:style' })
    editor.select([id])
  })
  const fill = page.getByRole('region', { name: 'Fill', exact: true })
  const style = fill.getByRole('combobox', { name: 'Fill style' })
  await expect(style).toHaveCount(1)
  await expect(style).toContainText('missing:style')
  await expect(fill).toHaveScreenshot('fill-missing-style.png')
  await style.click()
  await page.getByRole('option', { name: 'None', exact: true }).click()
  await expect(style).toHaveCount(0)
})
