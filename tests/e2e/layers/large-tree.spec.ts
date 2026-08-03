import { test, expect } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

const NODE_COUNT = 5000

test('large layer trees stay virtualized and scrollable', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/editor?test&no-rulers')
  await canvas.waitForInit()

  const replaceStartedAt = await page.evaluate((count: number) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const Graph = store.graph.constructor as new () => typeof store.graph
    const graph = new Graph()
    const pageId = graph.getPages()[0]?.id
    if (!pageId) throw new Error('Page not initialized')
    for (let i = 0; i < count; i++) {
      graph.createNode('RECTANGLE', pageId, {
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
    const startedAt = performance.now()
    store.replaceGraph(graph)
    return startedAt
  }, NODE_COUNT)

  await canvas.waitForRender()

  const scroller = page.getByTestId('layers-scroll')
  const rows = page.getByTestId('layers-item')

  await expect(rows.first()).toContainText('Layer 0001')
  await expect.poll(() => rows.count()).toBeLessThan(250)
  await expect
    .poll(() => page.evaluate((startedAt) => performance.now() - startedAt, replaceStartedAt))
    .toBeLessThan(5000)

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageNode = store.graph.getNode(store.state.currentPageId)
    const lastId = pageNode?.childIds.at(-1)
    if (!lastId) throw new Error('Last layer not found')
    store.select([lastId])
  })

  const lastRow = rows.filter({ hasText: 'Layer 5000' }).first()
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

  const renamedRow = rows.filter({ hasText: 'Last layer renamed' }).first()
  await expect(renamedRow).toBeVisible()
  await renamedRow.dblclick()
  const renameInput = page.getByTestId('layers-item-input')
  await expect(renameInput).toBeFocused()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const firstId = store.graph.getNode(store.state.currentPageId)?.childIds[0]
    if (!firstId) throw new Error('First layer not found')
    store.updateNodeWithUndo(firstId, { y: 48 }, 'Move first layer again')
  })

  await expect(renameInput).toBeFocused()
})

test('layer tree supports range and additive selection', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/editor?test&no-rulers')
  await canvas.waitForInit()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const Graph = store.graph.constructor as new () => typeof store.graph
    const graph = new Graph()
    const pageId = graph.getPages()[0]?.id
    if (!pageId) throw new Error('Page not initialized')
    for (let index = 1; index <= 8; index++) {
      graph.createNode('RECTANGLE', pageId, { name: `Layer ${index}` })
    }
    store.replaceGraph(graph)
  })

  const rows = page.getByTestId('layers-item')
  await rows.filter({ hasText: 'Layer 2' }).click()
  await page.keyboard.down('Shift')
  await rows.filter({ hasText: 'Layer 5' }).click()
  await page.keyboard.up('Shift')

  const selectedRows = page.getByTestId('layers-item').and(page.locator('[data-selected]'))
  await expect(selectedRows).toHaveCount(4)
  await expect(rows.filter({ hasText: 'Layer 2' })).toHaveAttribute('data-selected')
  await expect(rows.filter({ hasText: 'Layer 5' })).toHaveAttribute('data-selected')

  await page.keyboard.down('Meta')
  await rows.filter({ hasText: 'Layer 7' }).click()
  await page.keyboard.up('Meta')

  await expect(selectedRows).toHaveCount(5)
  await expect(rows.filter({ hasText: 'Layer 7' })).toHaveAttribute('data-selected')
})
