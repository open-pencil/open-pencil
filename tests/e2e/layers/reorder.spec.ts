import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function layerOrder(page: Page, parentId?: string) {
  return page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getNode(id ?? store.state.currentPageId)?.childIds ?? []
  }, parentId)
}

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

  const order = await layerOrder(page)

  expect(order).toEqual([ids.third, ids.first, ids.second])
  canvas.assertNoErrors()
})

test('dragging a layer into a container expands it and shows the child', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Drop Frame',
      x: 0,
      y: 0,
      width: 200,
      height: 120
    })
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Child Candidate',
      x: 240,
      y: 0,
      width: 80,
      height: 80
    })
    store.requestRender()
    return { frame: frame.id, rect: rect.id }
  })
  await canvas.waitForRender()

  const source = page.locator(`[data-node-id="${ids.rect}"] [data-test-id="layers-item"]`)
  const target = page.locator(`[data-node-id="${ids.frame}"] [data-test-id="layers-item"]`)
  await source.dragTo(target, { targetPosition: { x: 70, y: 12 } })
  await canvas.waitForRender()

  await expect(page.locator(`[data-node-id="${ids.rect}"] [data-test-id="layers-item"]`)).toBeVisible()
  expect(await layerOrder(page, ids.frame)).toEqual([ids.rect])
  canvas.assertNoErrors()
})
