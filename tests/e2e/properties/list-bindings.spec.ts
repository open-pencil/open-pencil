import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('a fill’s colour binding stays with it when a fill above it is removed', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const { id, red, blue } = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const collection = editor.graph.createCollection('Theme')
    const solid = (r: number, g: number, b: number) => ({
      type: 'SOLID' as const,
      color: { r, g, b, a: 1 },
      opacity: 1,
      visible: true
    })
    const red = editor.graph.createVariable('Red', 'COLOR', collection.id, solid(1, 0, 0).color)
    const blue = editor.graph.createVariable('Blue', 'COLOR', collection.id, solid(0, 0, 1).color)
    const id = editor.createShape('RECTANGLE', 100, 100, 180, 120)
    editor.updateNode(id, { fills: [solid(1, 0, 0), solid(0, 1, 0), solid(0, 0, 1)] })
    editor.graph.bindVariable(id, 'fills/0/color', red.id)
    editor.graph.bindVariable(id, 'fills/2/color', blue.id)
    editor.select([id])
    return { id, red: red.id, blue: blue.id }
  })
  const bindings = () =>
    page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.boundVariables, id)
  const fillCount = () =>
    page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.fills.length, id)

  const fill = page.getByRole('region', { name: 'Fill', exact: true })
  await fill.getByRole('button', { name: 'Remove fill' }).nth(1).click()
  await expect.poll(fillCount).toBe(2)
  await expect.poll(bindings).toEqual({ 'fills/0/color': red, 'fills/1/color': blue })

  await fill.getByRole('heading', { name: 'Fill' }).click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
  await expect.poll(fillCount).toBe(3)
  await expect.poll(bindings).toEqual({ 'fills/0/color': red, 'fills/2/color': blue })
})
