import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const theme of ['light', 'dark']) {
  test(`letter spacing variable lifecycle in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 })
    await page.goto('/?test')
    await new CanvasHelper(page).waitForInit()
    const id = await page.evaluate(async (mode) => {
      const path = '/src/app/shell/theme.ts'
      const module = await import(path)
      module.useAppTheme().setTheme(mode)
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      const id = editor.createShape('TEXT', 100, 100, 240, 80)
      editor.updateNode(id, { text: 'Tracking review', fontSize: 24, letterSpacing: 2 })
      editor.select([id])
      return id
    }, theme)
    const section = page.getByRole('region', { name: 'Typography', exact: true })
    const field = section.locator('[data-property="letterSpacing"]')
    await expect(field).toContainText('px')
    await field.getByRole('button', { name: 'Apply variable' }).click()
    await page.getByRole('button', { name: 'Create number variable from 2', exact: true }).click()
    await page.getByPlaceholder('Variable name').fill('Typography/Tracking/Comfortable')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(field).toHaveAttribute('data-bound')

    const input = section.getByRole('spinbutton', { name: 'Letter spacing', exact: true })
    await input.focus()
    await expect(field).toHaveAttribute('data-bound')

    await input.fill('3')
    await input.press('Enter')
    await expect
      .poll(() =>
        page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.letterSpacing, id)
      )
      .toBe(3)
    await expect(field).not.toHaveAttribute('data-bound')
    await section.getByRole('heading', { name: 'Typography', exact: true }).click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
    await expect(field).toHaveAttribute('data-bound')
    await field.getByRole('button', { name: 'Apply variable' }).click()
    await page.getByRole('button', { name: 'Detach variable', exact: true }).click()
    await expect(field).not.toHaveAttribute('data-bound')
  })
}
