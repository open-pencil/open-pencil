import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('automatic line height survives focus and can be restored with undo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 })
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const id = await page.evaluate(() => {
    const e = window.openPencil?.getStore?.()
    if (!e) throw new Error('No editor')
    const id = e.createShape('TEXT', 100, 100, 240, 80)
    e.updateNode(id, { text: 'Line height', fontSize: 24, lineHeight: null })
    e.select([id])
    return id
  })
  const field = page.locator('[data-property="lineHeight"]')
  await expect(field).toContainText('Auto')

  await page.evaluate((id) => window.openPencil?.getStore?.().updateNode(id, { fontSize: 30 }), id)
  const input = page.getByRole('spinbutton', { name: 'Line height', exact: true })
  await input.focus()
  await expect(input).toHaveValue('36')
  await input.press('Escape')
  await expect
    .poll(() =>
      page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.lineHeight, id)
    )
    .toBeNull()
  await input.focus()
  await input.fill('32')
  await input.press('Enter')
  await expect
    .poll(() =>
      page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.lineHeight, id)
    )
    .toBe(32)
  await page.getByRole('combobox', { name: 'Line height mode' }).click()
  await page.getByRole('option', { name: 'Auto', exact: true }).click()
  await expect(field).toContainText('Auto')
  await page.getByRole('heading', { name: 'Typography', exact: true }).click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
  await expect
    .poll(() =>
      page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.lineHeight, id)
    )
    .toBe(32)
  await field.getByRole('button', { name: 'Apply variable' }).click()
  await page.getByRole('button', { name: 'Create number variable from 32', exact: true }).click()
  await page.getByPlaceholder('Variable name').fill('Typography/Line height/Body')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(field).toHaveAttribute('data-bound')

  await page.getByRole('combobox', { name: 'Line height mode' }).click()
  await page.getByRole('option', { name: 'Auto', exact: true }).click()
  await expect(field).not.toHaveAttribute('data-bound')
  await expect(field).toContainText('Auto')
  await page.getByRole('heading', { name: 'Typography', exact: true }).click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
  await expect(field).toHaveAttribute('data-bound')
})
