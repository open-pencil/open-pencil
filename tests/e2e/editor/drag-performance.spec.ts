import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('dragging a nested card does not recompute layout on every pointer move', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0

    const pageId = store.state.currentPageId
    const card = store.graph.createNode('FRAME', pageId, {
      name: 'Perf Card',
      x: 100,
      y: 100,
      width: 260,
      height: 160,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    for (let i = 0; i < 20; i++) {
      store.graph.createNode('TEXT', card.id, {
        name: `Label ${i}`,
        text: `Label ${i}`,
        x: 16,
        y: 16 + i * 20,
        width: 180,
        height: 18
      })
    }
    store.select([card.id])
    store.requestRender()
  })
  await canvas.waitForRender()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const original = store.updateNode.bind(store)
    let count = 0
    store.updateNode = ((id, changes) => {
      count++
      return original(id, changes)
    }) as typeof store.updateNode
    Object.assign(window, { __openPencilUpdateNodeCount: () => count })
  })

  await canvas.drag(110, 110, 210, 150, 20)

  const updateNodeCalls = await page.evaluate(() => {
    const getCount = (window as typeof window & { __openPencilUpdateNodeCount?: () => number })
      .__openPencilUpdateNodeCount
    return getCount?.() ?? 0
  })

  expect(updateNodeCalls).toBe(0)
  canvas.assertNoErrors()
})
