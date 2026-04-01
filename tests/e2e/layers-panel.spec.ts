import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/demo')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

function layerRows() {
  return page.locator('[data-node-id]')
}

async function getLayerNames(): Promise<string[]> {
  const rows = layerRows()
  const count = await rows.count()
  const names: string[] = []
  for (let i = 0; i < count; i++) {
    const text = await rows.nth(i).innerText()
    names.push(text.trim())
  }
  return names
}

async function getSceneTree() {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__
    if (!store) return null

    function nodeTree(id: string): { name: string; type: string; children: unknown[] } | null {
      const node = store.graph.getNode(id)
      if (!node) return null
      return {
        name: node.name,
        type: node.type,
        children: node.childIds.map((cid: string) => nodeTree(cid)).filter(Boolean),
      }
    }
    return nodeTree(store.state.currentPageId)
  })
}

async function getSelectedCount(): Promise<number> {
  return page.evaluate(() => {
    return window.__OPEN_PENCIL_STORE__!.state.selectedIds.size
  })
}

test('demo layers visible in panel', async () => {
  const names = await getLayerNames()
  expect(names).toContain('Components')
  expect(names).toContain('App Preview')
})

test('clicking a node inside a frame does not reparent it', async () => {
  const beforeTree = await getSceneTree()
  const section = beforeTree.children.find((c: any) => c.name === 'App Preview')
  const dashboard = section.children.find((c: any) => c.name === 'Dashboard')
  expect(dashboard).toBeTruthy()
  const sidebarBefore = dashboard.children.find((c: any) => c.name === 'Sidebar')
  expect(sidebarBefore).toBeTruthy()

  // Click inside the App Preview section area
  await canvas.click(350, 310)
  await canvas.waitForRender()

  // Sidebar should still be a child of Dashboard
  const afterTree = await getSceneTree()
  const afterSection = afterTree.children.find((c: any) => c.name === 'App Preview')
  const afterDashboard = afterSection.children.find((c: any) => c.name === 'Dashboard')
  expect(afterDashboard.children.find((c: any) => c.name === 'Sidebar')).toBeTruthy()

  canvas.assertNoErrors()
})

test('creating a shape updates layers', async () => {
  const before = await getLayerNames()
  await canvas.drawRect(600, 500, 50, 50)
  const names = await getLayerNames()
  expect(names).toContain('Rectangle')
  expect(names.length).toBe(before.length + 1)

  await canvas.undo()
  const after = await getLayerNames()
  expect(after.length).toBe(before.length)
  expect(after).not.toContain('Rectangle')
})

test('Shift+A wraps selection in auto-layout frame', async () => {
  // Draw two loose rectangles for this test
  await canvas.drawRect(700, 600, 60, 60)
  await canvas.drawRect(800, 600, 60, 60)
  await canvas.selectAll()
  const count = await getSelectedCount()
  expect(count).toBeGreaterThanOrEqual(2)

  const before = await getLayerNames()

  await page.keyboard.press('Shift+A')
  await canvas.waitForRender()

  const tree = await getSceneTree()
  const autoFrame = tree.children.find((c: any) => c.name === 'Frame' && c.type === 'FRAME')
  expect(autoFrame).toBeTruthy()

  const after = await getLayerNames()
  expect(after).not.toEqual(before)
  expect(after).toContain('Frame')

  canvas.assertNoErrors()
})

test('grouping updates layers', async () => {
  // Undo the auto-layout to restore flat structure
  await canvas.undo()
  await canvas.undo()
  await canvas.waitForRender()

  // Draw two rects and group them
  await canvas.drawRect(700, 600, 60, 60)
  await canvas.drawRect(800, 600, 60, 60)
  await canvas.selectAll()

  const beforeCount = await getSelectedCount()
  await page.keyboard.press('Meta+g')
  await canvas.waitForRender()

  const tree = await getSceneTree()
  const group = tree.children.find((c: any) => c.name === 'Group' && c.type === 'GROUP')
  expect(group).toBeTruthy()

  const names = await getLayerNames()
  expect(names).toContain('Group')

  canvas.assertNoErrors()
})

test('ungrouping updates layers', async () => {
  await page.keyboard.press('Shift+Meta+g')
  await canvas.waitForRender()

  const names = await getLayerNames()
  expect(names).not.toContain('Group')
  expect(names).toContain('Rectangle')

  canvas.assertNoErrors()
})

test('double-click layer to rename', async () => {
  await canvas.drawRect(900, 600, 50, 50)
  await canvas.waitForRender()

  const row = layerRows().filter({ hasText: 'Rectangle' }).first()
  await row.dblclick()

  const input = page.locator('[data-test-id="layers-item-input"]')
  await expect(input).toBeVisible()
  await input.fill('Renamed Layer')
  await input.press('Enter')

  await canvas.waitForRender()
  const names = await getLayerNames()
  expect(names).toContain('Renamed Layer')

  canvas.assertNoErrors()
})

test('clicking outside rename input commits', async () => {
  const row = layerRows().filter({ hasText: 'Renamed Layer' }).first()
  await row.dblclick()

  const input = page.locator('[data-test-id="layers-item-input"]')
  await expect(input).toBeVisible()
  await input.fill('After Outside Click')

  await page.mouse.click(500, 400)
  await canvas.waitForRender()

  await expect(input).not.toBeVisible()
  const names = await getLayerNames()
  expect(names).toContain('After Outside Click')

  canvas.assertNoErrors()
})

test('clearing a layer name falls back to the default node name', async () => {
  await canvas.drawRect(980, 600, 50, 50)
  await canvas.waitForRender()

  const row = layerRows().filter({ hasText: 'Rectangle' }).last()
  const countBefore = await layerRows().count()

  await row.dblclick()

  const input = page.locator('[data-test-id="layers-item-input"]')
  await expect(input).toBeVisible()
  await input.clear()
  await input.press('Enter')

  await canvas.waitForRender()

  const countAfter = await layerRows().count()
  expect(countAfter).toBe(countBefore)

  const names = await getLayerNames()
  expect(names.filter((name) => name === 'Rectangle').length).toBeGreaterThan(0)

  canvas.assertNoErrors()
})

test('double-click does not toggle tree expand', async () => {
  const rowCountBefore = await layerRows().count()

  const containerRow = layerRows().filter({ hasText: 'Components' }).first()
  await containerRow.dblclick()
  await canvas.waitForRender()

  const input = page.locator('[data-test-id="layers-item-input"]')
  await expect(input).toBeVisible()
  await input.press('Escape')

  const rowCountAfter = await layerRows().count()
  expect(rowCountAfter).toBe(rowCountBefore)

  canvas.assertNoErrors()
})
