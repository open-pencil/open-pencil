import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('dragging layers reorders scene nodes', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const first = store.graph.createNode('RECTANGLE', pageId, { name: 'Layer A', x: 0, y: 0 })
    const second = store.graph.createNode('RECTANGLE', pageId, { name: 'Layer B', x: 120, y: 0 })
    const third = store.graph.createNode('RECTANGLE', pageId, { name: 'Layer C', x: 240, y: 0 })
    store.requestRender()
    return { first: first.id, second: second.id, third: third.id }
  })
  await canvas.waitForRender()

  const source = page.locator(`[data-node-id="${ids.third}"] [data-test-id="layers-item"]`)
  const target = page.locator(`[data-node-id="${ids.first}"] [data-test-id="layers-item"]`)
  await source.dragTo(target, { targetPosition: { x: 20, y: 2 } })
  await canvas.waitForRender()

  const order = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getNode(store.state.currentPageId)?.childIds ?? []
  })

  expect(order).toEqual([ids.third, ids.first, ids.second])
  canvas.assertNoErrors()
})
