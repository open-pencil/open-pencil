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
    .toEqual({ value: 32, unit: 'PIXELS' })
  await page.getByRole('combobox', { name: 'Line height mode' }).click()
  await page.getByRole('option', { name: 'Auto', exact: true }).click()
  await expect(field).toContainText('Auto')
  await page.getByRole('heading', { name: 'Typography', exact: true }).click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
  await expect
    .poll(() =>
      page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.lineHeight, id)
    )
    .toEqual({ value: 32, unit: 'PIXELS' })
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

test('a typed % or px switches the unit of line height and letter spacing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 })
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const id = await page.evaluate(() => {
    const e = window.openPencil?.getStore?.()
    if (!e) throw new Error('No editor')
    const id = e.createShape('TEXT', 100, 100, 240, 80)
    e.updateNode(id, {
      text: 'Units',
      fontSize: 20,
      lineHeight: { value: 24, unit: 'PIXELS' },
      letterSpacing: { value: 0, unit: 'PIXELS' }
    })
    e.select([id])
    return id
  })
  const read = (field: 'lineHeight' | 'letterSpacing') =>
    page.evaluate(({ id, field }) => window.openPencil?.getStore?.().graph.getNode(id)?.[field], {
      id,
      field
    })
  const type = async (name: string, text: string) => {
    const input = page.getByRole('spinbutton', { name, exact: true })
    await input.focus()
    await input.fill(text)
    await input.press('Enter')
  }

  await type('Line height', '150%')
  await expect.poll(() => read('lineHeight')).toEqual({ value: 150, unit: 'PERCENT' })
  await expect(page.locator('[data-property="lineHeight"]')).toContainText('%')
  await type('Line height', '30px')
  await expect.poll(() => read('lineHeight')).toEqual({ value: 30, unit: 'PIXELS' })
  // Stepping a typed value keeps the unit typed after it.
  const lineHeight = page.getByRole('spinbutton', { name: 'Line height', exact: true })
  await lineHeight.focus()
  await lineHeight.fill('150%')
  await lineHeight.press('ArrowUp')
  // The canvas previews the stepped value in the unit typed, before Enter commits it.
  await expect.poll(() => read('lineHeight')).toEqual({ value: 151, unit: 'PERCENT' })
  await lineHeight.press('Enter')
  await expect.poll(() => read('lineHeight')).toEqual({ value: 151, unit: 'PERCENT' })
  await type('Line height', '30px')
  await expect.poll(() => read('lineHeight')).toEqual({ value: 30, unit: 'PIXELS' })
  await type('Letter spacing', '2%')
  await expect.poll(() => read('letterSpacing')).toEqual({ value: 2, unit: 'PERCENT' })

  await page.getByRole('heading', { name: 'Typography', exact: true }).click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
  await expect.poll(() => read('letterSpacing')).toEqual({ value: 0, unit: 'PIXELS' })
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
  await expect.poll(() => read('lineHeight')).toEqual({ value: 151, unit: 'PERCENT' })

  // A value stepped below zero stays that value, not an expression subtracting from the start.
  await type('Letter spacing', '2px')
  await expect.poll(() => read('letterSpacing')).toEqual({ value: 2, unit: 'PIXELS' })
  const letterSpacing = page.getByRole('spinbutton', { name: 'Letter spacing', exact: true })
  await letterSpacing.focus()
  await letterSpacing.fill('0px')
  await letterSpacing.press('ArrowDown')
  await letterSpacing.press('ArrowDown')
  await letterSpacing.press('Enter')
  await expect.poll(() => read('letterSpacing')).toEqual({ value: -2, unit: 'PIXELS' })

  // The value a field opens with is that value, not an expression: Enter keeps it, ArrowUp steps up.
  await letterSpacing.blur()
  await letterSpacing.focus()
  await letterSpacing.press('Enter')
  await expect.poll(() => read('letterSpacing')).toEqual({ value: -2, unit: 'PIXELS' })
  await letterSpacing.focus()
  await letterSpacing.press('ArrowUp')
  await letterSpacing.press('Enter')
  await expect.poll(() => read('letterSpacing')).toEqual({ value: -1, unit: 'PIXELS' })

  // Escape puts back the value and unit the layer had, whatever unit the preview showed.
  await letterSpacing.focus()
  await letterSpacing.fill('3%')
  await letterSpacing.press('ArrowUp')
  await expect.poll(() => read('letterSpacing')).toEqual({ value: 4, unit: 'PERCENT' })
  await letterSpacing.press('Escape')
  await expect.poll(() => read('letterSpacing')).toEqual({ value: -1, unit: 'PIXELS' })

  // A change of unit alone, with the number kept, is a commit and an undo step of its own.
  await expect.poll(() => read('lineHeight')).toEqual({ value: 151, unit: 'PERCENT' })
  await type('Line height', '151px')
  await expect.poll(() => read('lineHeight')).toEqual({ value: 151, unit: 'PIXELS' })
  await page.getByRole('heading', { name: 'Typography', exact: true }).click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
  await expect.poll(() => read('lineHeight')).toEqual({ value: 151, unit: 'PERCENT' })
})
