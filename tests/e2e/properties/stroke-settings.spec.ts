import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const theme of ['light', 'dark']) {
  test(`stroke settings editing and dismissal in ${theme}`, async ({ page }) => {
    await page.goto('/?test')
    await new CanvasHelper(page).waitForInit()
    const ids = await page.evaluate(async (mode) => {
      const path = '/src/app/shell/theme.ts'
      const module = await import(path)
      module.useAppTheme().setTheme(mode)
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      const id = editor.createShape('RECTANGLE', 100, 100, 180, 120)
      const line = editor.createShape('LINE', 100, 300, 180, 0)
      for (const target of [id, line])
        editor.updateNode(target, {
          strokes: [
            {
              color: { r: 0, g: 0, b: 0, a: 1 },
              weight: 2,
              opacity: 1,
              visible: true,
              align: 'CENTER'
            }
          ]
        })
      editor.select([id])
      return { id, line }
    }, theme)
    const section = page.getByRole('region', { name: 'Stroke', exact: true })
    await expect(section).toHaveScreenshot(`stroke-main-${theme}.png`)
    const trigger = section.getByRole('button', { name: 'Stroke settings' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Stroke settings' })
    await dialog.getByRole('switch', { name: 'Dashed stroke' }).click()
    const dash = dialog.getByRole('spinbutton', { name: 'Dash', exact: true })
    await dash.focus()
    await dash.fill('10')
    await dash.press('Enter')
    await expect
      .poll(() =>
        page.evaluate(
          (id) => window.openPencil?.getStore?.().graph.getNode(id)?.strokes[0].dashPattern?.[0],
          ids.id
        )
      )
      .toBe(10)
    await expect(dialog).toHaveScreenshot(`stroke-dashed-${theme}.png`)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.click()
    await page.evaluate((id) => window.openPencil?.getStore?.().select([id]), ids.line)
    await dialog.getByRole('button', { name: 'Round cap', exact: true }).click()
    await expect
      .poll(() =>
        page.evaluate(
          (id) => window.openPencil?.getStore?.().graph.getNode(id)?.strokeCap,
          ids.line
        )
      )
      .toBe('ROUND')
    await expect
      .poll(() =>
        page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.strokeCap, ids.id)
      )
      .toBe('NONE')
    await expect(dialog).toHaveScreenshot(`stroke-line-${theme}.png`)
  })
}
