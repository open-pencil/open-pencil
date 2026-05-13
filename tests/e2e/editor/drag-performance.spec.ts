import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('dragging a nested card uses repaint-only position previews', async ({ page }) => {
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
    const originalStoreUpdate = store.updateNode.bind(store)
    const originalGraphUpdate = store.graph.updateNode.bind(store.graph)
    let storeUpdateCount = 0
    let graphUpdateCount = 0
    let renderCount = 0
    let repaintCount = 0
    store.updateNode = ((id, changes) => {
      storeUpdateCount++
      return originalStoreUpdate(id, changes)
    }) as typeof store.updateNode
    store.graph.updateNode = ((id, changes) => {
      graphUpdateCount++
      return originalGraphUpdate(id, changes)
    }) as typeof store.graph.updateNode
    store.onEditorEvent('render:requested', () => {
      renderCount++
    })
    store.onEditorEvent('repaint:requested', () => {
      repaintCount++
    })
    Object.assign(window, {
      __openPencilDragCounters: () => ({ storeUpdateCount, graphUpdateCount, renderCount, repaintCount })
    })
  })

  await canvas.drag(110, 110, 210, 150, 20)

  const counters = await page.evaluate(() => {
    const getCounters = (
      window as typeof window & {
        __openPencilDragCounters?: () => {
          storeUpdateCount: number
          graphUpdateCount: number
          renderCount: number
          repaintCount: number
        }
      }
    ).__openPencilDragCounters
    return getCounters?.() ?? null
  })

  expect(counters?.storeUpdateCount).toBe(0)
  expect(counters?.graphUpdateCount).toBe(0)
  expect(counters?.renderCount).toBe(0)
  expect(counters?.repaintCount).toBeGreaterThan(0)
  canvas.assertNoErrors()
})
