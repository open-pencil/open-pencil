import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const theme of ['light', 'dark']) {
  test(`inline effect settings in ${theme}`, async ({ page }) => {
    await page.goto('/?test')
    await new CanvasHelper(page).waitForInit()
    const id = await page.evaluate(async (mode) => {
      const path = '/src/app/shell/theme.ts'
      const module = await import(path)
      module.useAppTheme().setTheme(mode)
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      const id = editor.createShape('RECTANGLE', 100, 100, 180, 120)
      editor.updateNode(id, {
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.25 },
            offset: { x: 0, y: 4 },
            radius: 12,
            spread: 0,
            visible: true
          }
        ]
      })
      editor.select([id])
      return id
    }, theme)
    const section = page.getByRole('region', { name: 'Effects', exact: true })
    await section.getByRole('button', { name: 'Expand effect settings' }).click()
    if (theme === 'light') await expect(section).toHaveScreenshot('inline-shadow-light.png')
    const radius = section.getByRole('spinbutton', { name: 'B', exact: true })
    await radius.focus()
    await radius.fill('20')
    await radius.press('Enter')
    await expect
      .poll(() =>
        page.evaluate(
          (id) => window.openPencil?.getStore?.().graph.getNode(id)?.effects[0].radius,
          id
        )
      )
      .toBe(20)
    await section.getByRole('heading', { name: 'Effects' }).click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
    await expect
      .poll(() =>
        page.evaluate(
          (id) => window.openPencil?.getStore?.().graph.getNode(id)?.effects[0].radius,
          id
        )
      )
      .toBe(12)
    await section.getByRole('combobox', { name: 'Effects', exact: true }).click()
    await page.getByRole('option', { name: 'Layer blur', exact: true }).click()
    await expect(section.getByRole('spinbutton', { name: 'B', exact: true })).toBeVisible()
    await section.getByRole('button', { name: 'Remove effect' }).click()
    await expect
      .poll(() =>
        page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.effects, id)
      )
      .toEqual([])
    await expect(section.locator('[data-slot="effect-settings"]')).toHaveCount(0)
  })
}
