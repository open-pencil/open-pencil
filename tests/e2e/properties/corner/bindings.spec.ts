import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertyField, propertySection } from '#tests/helpers/properties'

const paths = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'] as const

test('collapsed equivalent corners preserve their shared token through expansion and edits', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const id = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const collection = editor.graph.createCollection('Corners')
    const variable = editor.graph.createVariable('Radius/shared', 'FLOAT', collection.id, 12)
    const node = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Shared corner bindings',
      x: 100,
      y: 100,
      width: 160,
      height: 120,
      cornerRadius: 0,
      independentCorners: true,
      topLeftRadius: 12,
      topRightRadius: 12,
      bottomRightRadius: 12,
      bottomLeftRadius: 12,
      boundVariables: {
        topLeftRadius: variable.id,
        topRightRadius: variable.id,
        bottomRightRadius: variable.id,
        bottomLeftRadius: variable.id
      }
    })
    editor.select([node.id])
    editor.requestRender()
    return node.id
  })
  const section = propertySection(page, 'Appearance')
  const field = propertyField(page, 'cornerRadius')
  await expect(field).toHaveAttribute('data-bound')
  // A bound number shows its value; hovering the variable button names the variable.
  await expect(field).toContainText('12')
  await field.getByRole('button', { name: 'Apply variable' }).hover()
  await expect(page.getByRole('tooltip')).toHaveText('Radius/shared')
  await page.mouse.move(0, 0)
  if (process.platform === 'darwin') {
    await expect(section).toHaveScreenshot('shared-corner-token.png')
  }
  const readCorners = () =>
    page.evaluate(
      ({ id, paths }) => {
        const node = window.openPencil?.getStore?.().graph.getNode(id)
        if (!node) throw new Error('Missing fixture')
        return {
          values: paths.map((path) => node[path]),
          bindings: paths.map((path) => node.boundVariables[path] ?? null),
          independent: node.independentCorners
        }
      },
      { id, paths }
    )
  const original = await readCorners()
  const toggle = section.getByRole('button', { name: 'Independent corner radii' })
  await toggle.click()
  for (const path of paths) {
    await expect(propertyField(page, path)).toHaveAttribute('data-bound')
    await expect(propertyField(page, path)).toContainText('12')
  }
  expect(await readCorners()).toEqual(original)
  await toggle.click()
  await expect(field).toHaveAttribute('data-bound')
  await field.click({ position: { x: 40, y: 13 } })
  const input = field.getByRole('spinbutton', { name: 'Radius', exact: true })
  await expect(input).toHaveValue('12')
  await input.press('Tab')
  expect(await readCorners()).toEqual(original)
  await field.click({ position: { x: 40, y: 13 } })
  await input.fill('18')
  await input.press('Escape')
  await expect(field).toHaveAttribute('data-bound')
  expect(await readCorners()).toEqual(original)
  await field.click({ position: { x: 40, y: 13 } })
  await input.fill('24')
  await input.press('Enter')
  expect(await readCorners()).toEqual({
    values: [24, 24, 24, 24],
    bindings: [null, null, null, null],
    independent: false
  })
  await canvas.pressKey('Meta+z')
  await expect(field).toHaveAttribute('data-bound')
  expect(await readCorners()).toEqual(original)
  await canvas.pressKey('Meta+Shift+z')
  expect(await readCorners()).toEqual({
    values: [24, 24, 24, 24],
    bindings: [null, null, null, null],
    independent: false
  })
  canvas.assertNoErrors()
})
