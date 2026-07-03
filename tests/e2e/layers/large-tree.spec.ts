import { test, expect } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

const NODE_COUNT = 1200

test('large layer trees stay virtualized and scrollable', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test&no-rulers')
  await canvas.waitForInit()

  await page.evaluate((count: number) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    for (let i = 0; i < count; i++) {
      store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        name: `Layer ${String(i + 1).padStart(4, '0')}`,
        x: (i % 40) * 24,
        y: Math.floor(i / 40) * 24,
        width: 16,
        height: 16,
        fills: [
          {
            type: 'SOLID',
            color: { r: 0.2, g: 0.5, b: 0.9, a: 1 },
            visible: true,
            opacity: 1
          }
        ]
      })
    }
    store.requestRender()
  }, NODE_COUNT)

  await canvas.waitForRender()

  const scroller = page.getByTestId('layers-scroll')
  const rows = page.getByTestId('layers-item')

  await expect(rows.first()).toContainText('Layer 0001')
  await expect.poll(() => rows.count()).toBeLessThan(200)

  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })

  const lastRow = rows.filter({ hasText: 'Layer 1200' }).first()
  await expect(lastRow).toBeVisible()
  const scrollBefore = await scroller.evaluate((el) => el.scrollTop)

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const pageNode = store.graph.getNode(store.state.currentPageId)
    const firstId = pageNode?.childIds[0]
    if (!firstId) throw new Error('First layer not found')
    store.updateNodeWithUndo(firstId, { x: 32 }, 'Move first layer')
  })

  await expect(lastRow).toBeVisible()
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
  )
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(scrollBefore)

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const pageNode = store.graph.getNode(store.state.currentPageId)
    const lastId = pageNode?.childIds.at(-1)
    if (!lastId) throw new Error('Last layer not found')
    store.renameNode(lastId, 'Last layer renamed')
  })

  await expect(rows.filter({ hasText: 'Last layer renamed' }).first()).toBeVisible()
})
