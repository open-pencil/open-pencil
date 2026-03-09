import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

function getPageChildCount() {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return store.graph.getChildren(store.state.currentPageId).length
  })
}

function getSelectedCount() {
  return page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.selectedIds.size)
}

function getSelectedNodes() {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return [...store.state.selectedIds].map((id) => {
      const n = store.graph.getNode(id)!
      return { id: n.id, name: n.name, type: n.type, x: n.x, y: n.y, width: n.width, height: n.height, fills: n.fills }
    })
  })
}

test('copy + paste via store duplicates a shape', async () => {
  await canvas.drawRect(100, 100, 120, 80)
  await canvas.waitForRender()

  const countBefore = await getPageChildCount()

  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const data = new DataTransfer()
    store.writeCopyData(data)
    const html = data.getData('text/html')
    if (html) store.pasteFromHTML(html)
  })
  await canvas.waitForRender()

  const countAfter = await getPageChildCount()
  expect(countAfter).toBe(countBefore + 1)
})

test('pasted node is offset from original', async () => {
  const nodes = await getSelectedNodes()
  expect(nodes).toHaveLength(1)

  const pasted = nodes[0]
  expect(pasted.name).toBe('Rectangle')
})

test('⌘D duplicates in place', async () => {
  // Clear canvas and start fresh
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 100, 80)
  await canvas.waitForRender()

  const countBefore = await getPageChildCount()
  await canvas.duplicate()

  const countAfter = await getPageChildCount()
  expect(countAfter).toBe(countBefore + 1)
  expect(await getSelectedCount()).toBe(1)
})

test('duplicate preserves fills', async () => {
  // Set a custom fill on the selected node
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const id = [...store.state.selectedIds][0]
    store.updateNodeWithUndo(id, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0.5, b: 1, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }]
    }, 'Set fill')
  })
  await canvas.waitForRender()

  await canvas.duplicate()

  const nodes = await getSelectedNodes()
  expect(nodes[0].fills[0].color.b).toBeCloseTo(1, 1)
})

test('cut removes original', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 80, 60)
  await canvas.waitForRender()

  expect(await getPageChildCount()).toBe(1)

  // Cut via store
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const data = new DataTransfer()
    store.writeCopyData(data)
    store.deleteSelected()
  })
  await canvas.waitForRender()

  expect(await getPageChildCount()).toBe(0)
})

test('multi-select duplicate creates copies of all', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 60, 60)
  await canvas.drawRect(200, 100, 60, 60)
  await canvas.selectAll()
  await canvas.waitForRender()

  expect(await getSelectedCount()).toBe(2)

  const countBefore = await getPageChildCount()
  await canvas.duplicate()

  const countAfter = await getPageChildCount()
  expect(countAfter).toBe(countBefore + 2)

  canvas.assertNoErrors()
})
