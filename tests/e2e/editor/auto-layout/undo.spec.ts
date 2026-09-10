import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('wrap clears automatic spacing and restores both properties with one Undo', async ({
  page
}) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const id = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const id = editor.createShape('FRAME', 100, 100, 320, 240)
    editor.updateNode(id, {
      layoutMode: 'HORIZONTAL',
      layoutWrap: 'NO_WRAP',
      primaryAxisAlign: 'SPACE_BETWEEN'
    })
    editor.select([id])
    return id
  })
  const state = () =>
    page.evaluate((id) => {
      const node = window.openPencil?.getStore?.().graph.getNode(id)
      return [node?.layoutWrap, node?.primaryAxisAlign]
    }, id)
  await page.getByRole('button', { name: 'Wrap layout', exact: true }).click()
  await expect.poll(state).toEqual(['WRAP', 'MIN'])
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(state).toEqual(['NO_WRAP', 'SPACE_BETWEEN'])
})

test('layout guide live numeric edits form one Undo record', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const id = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const id = editor.createShape('FRAME', 100, 100, 320, 240)
    editor.updateNode(id, {
      layoutGrids: [
        {
          pattern: 'COLUMNS',
          count: 5,
          gutterSize: 20,
          offset: 0,
          visible: true,
          color: { r: 1, g: 0, b: 0, a: 0.1 }
        }
      ]
    })
    editor.select([id])
    return id
  })
  const value = () =>
    page.evaluate(
      (id) => window.openPencil?.getStore?.().graph.getNode(id)?.layoutGrids[0].count,
      id
    )
  const field = page.getByRole('spinbutton', { name: 'Count', exact: true })
  await field.dblclick()
  await field.fill('12')
  await field.fill('18')
  await field.press('Enter')
  await expect.poll(value).toBe(18)
  await page.getByRole('heading', { name: 'Layout guide', exact: true }).click()
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(value).toBe(5)
})
