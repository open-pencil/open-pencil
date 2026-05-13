import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { getEditingTextId } from '#tests/helpers/store'

test('double-click drill-selects nested text without entering text edit mode', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0

    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 100,
      y: 100,
      width: 220,
      height: 120,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const text = store.graph.createNode('TEXT', frame.id, {
      name: 'Nested label',
      text: 'Nested label',
      x: 20,
      y: 20,
      width: 140,
      height: 30,
      fontSize: 18
    })
    store.select([frame.id])
    store.requestRender()
    return { frame: frame.id, text: text.id }
  })
  await canvas.waitForRender()

  await canvas.dblclick(125, 125)

  const state = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return {
      selectedIds: [...store.state.selectedIds],
      enteredContainerId: store.state.enteredContainerId
    }
  })

  expect(state.enteredContainerId).toBeNull()
  expect(state.selectedIds).toEqual([ids.text])
  expect(await getEditingTextId(page)).toBeNull()
  canvas.assertNoErrors()
})
