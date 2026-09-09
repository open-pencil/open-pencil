import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const theme of ['light', 'dark']) {
  test(`auto-layout spacing compositions in ${theme}`, async ({ page }) => {
    await page.goto('/?test')
    await new CanvasHelper(page).waitForInit()
    const id = await page.evaluate(async (colorMode) => {
      const path = '/src/app/shell/theme.ts'
      const module = await import(path)
      module.useAppTheme().setTheme(colorMode)
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      const id = editor.createShape('FRAME', 100, 100, 320, 240)
      editor.updateNode(id, {
        layoutMode: 'VERTICAL',
        itemSpacing: 16,
        paddingTop: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        paddingRight: 24
      })
      editor.select([id])
      return id
    }, theme)
    const section = page.getByRole('region', { name: 'Auto layout', exact: true })
    await page.evaluate(
      (id) =>
        window.openPencil?.getStore?.().updateNode(id, {
          primaryAxisAlign: 'SPACE_BETWEEN',
          paddingTop: 12,
          paddingRight: 16,
          paddingBottom: 24,
          paddingLeft: 32
        }),
      id
    )
    await page.evaluate(
      (id) =>
        window.openPencil?.getStore?.().updateNode(id, {
          layoutMode: 'HORIZONTAL',
          layoutWrap: 'WRAP',
          primaryAxisAlign: 'MIN',
          counterAxisSpacing: 8
        }),
      id
    )
    await expect(section).toHaveScreenshot(`auto-layout-wrap-${theme}.png`)
  })
}
