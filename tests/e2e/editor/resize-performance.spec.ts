import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('resizing uses repaint-only previews until mouseup', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const id = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const node = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Resizable Card',
      x: 100,
      y: 100,
      width: 240,
      height: 140,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    for (let i = 0; i < 12; i++) {
      store.graph.createNode('TEXT', node.id, {
        name: `Label ${i}`,
        text: `Label ${i}`,
        x: 16,
        y: 16 + i * 18,
        width: 160,
        height: 16
      })
    }
    store.select([node.id])
    store.requestRender()
    return node.id
  })
  await canvas.waitForRender()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const originalStoreUpdate = store.updateNode.bind(store)
    const originalGraphUpdate = store.graph.updateNode.bind(store.graph)
    let storeUpdateCount = 0
    let graphUpdateCount = 0
    let repaintCount = 0
    store.updateNode = ((nodeId, changes) => {
      storeUpdateCount++
      return originalStoreUpdate(nodeId, changes)
    }) as typeof store.updateNode
    store.graph.updateNode = ((nodeId, changes) => {
      graphUpdateCount++
      return originalGraphUpdate(nodeId, changes)
    }) as typeof store.graph.updateNode
    store.onEditorEvent('repaint:requested', () => {
      repaintCount++
    })
    Object.assign(window, {
      __openPencilResizeCounters: () => ({ storeUpdateCount, graphUpdateCount, repaintCount })
    })
  })

  await canvas.drag(340, 240, 420, 290, 12)

  const counters = await page.evaluate(() => {
    const getCounters = (
      window as typeof window & {
        __openPencilResizeCounters?: () => {
          storeUpdateCount: number
          graphUpdateCount: number
          repaintCount: number
        }
      }
    ).__openPencilResizeCounters
    return getCounters?.() ?? null
  })
  const node = await page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getNode(nodeId)
  }, id)

  expect(counters?.storeUpdateCount).toBeLessThanOrEqual(1)
  expect(counters?.graphUpdateCount).toBeLessThanOrEqual(1)
  expect(counters?.repaintCount).toBeGreaterThan(0)
  expect(node?.width).toBeGreaterThan(240)
  expect(node?.height).toBeGreaterThan(140)
  canvas.assertNoErrors()
})
