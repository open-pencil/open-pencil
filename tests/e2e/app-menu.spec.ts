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

test('menu bar is visible in browser mode', async () => {
  const menubar = page.locator('[role="menubar"]')
  await expect(menubar).toBeVisible()
})

test('menu bar has all top-level menus', async () => {
  const triggers = page.locator('[role="menubar"] [role="menuitem"]')
  const labels = await triggers.allTextContents()
  expect(labels).toEqual(['File', 'Edit', 'View', 'Object', 'Text', 'Arrange'])
})

test('File menu opens and shows items', async () => {
  await page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'File' }).click()
  const menu = page.locator('[role="menu"]')
  await expect(menu).toBeVisible()

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.includes('Open'))).toBe(true)
  expect(items.some((t) => t.includes('Save'))).toBe(true)
  expect(items.some((t) => t.includes('Save as'))).toBe(true)

  await page.keyboard.press('Escape')
})

test('Edit menu shows Undo/Redo/Delete', async () => {
  await page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'Edit' }).click()
  const menu = page.locator('[role="menu"]')
  await expect(menu).toBeVisible()

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.includes('Undo'))).toBe(true)
  expect(items.some((t) => t.includes('Redo'))).toBe(true)
  expect(items.some((t) => t.includes('Delete'))).toBe(true)
  expect(items.some((t) => t.includes('Select all'))).toBe(true)

  await page.keyboard.press('Escape')
})

test('View menu shows zoom options', async () => {
  await page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'View' }).click()
  const menu = page.locator('[role="menu"]')
  await expect(menu).toBeVisible()

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.includes('Zoom to fit'))).toBe(true)
  expect(items.some((t) => t.includes('Zoom in'))).toBe(true)
  expect(items.some((t) => t.includes('Zoom out'))).toBe(true)

  await page.keyboard.press('Escape')
})

test('Object menu shows Group/Ungroup/Component', async () => {
  await page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'Object' }).click()
  const menu = page.locator('[role="menu"]')
  await expect(menu).toBeVisible()

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.includes('Group'))).toBe(true)
  expect(items.some((t) => t.includes('Ungroup'))).toBe(true)
  expect(items.some((t) => t.includes('Create component'))).toBe(true)
  expect(items.some((t) => t.includes('Bring to front'))).toBe(true)
  expect(items.some((t) => t.includes('Send to back'))).toBe(true)

  await page.keyboard.press('Escape')
})

test('Undo via Edit menu works', async () => {
  await canvas.drawRect(200, 200, 100, 100)
  const beforeUndo = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.selectedIds.size)
  expect(beforeUndo).toBe(1)

  await page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'Edit' }).click()
  await page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Undo' }).click()
  await canvas.waitForRender()

  const afterUndo = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.selectedIds.size)
  expect(afterUndo).toBe(0)
})

test('Duplicate via Edit menu works', async () => {
  await canvas.drawRect(300, 300, 80, 80)

  const countBefore = await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return store.graph.getChildren(store.state.currentPageId).length
  })

  await page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'Edit' }).click()
  await page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Duplicate' }).click()
  await canvas.waitForRender()

  const countAfter = await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return store.graph.getChildren(store.state.currentPageId).length
  })

  expect(countAfter).toBe(countBefore + 1)
})

test('Zoom to fit via View menu works', async () => {
  await page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'View' }).click()
  await page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Zoom in' }).click()
  await canvas.waitForRender()

  const zoomBefore = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.zoom)
  expect(zoomBefore).toBeGreaterThan(1)

  await page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'View' }).click()
  await page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Zoom to fit' }).click()
  await canvas.waitForRender()

  const zoomAfter = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.zoom)
  expect(zoomAfter).not.toBe(zoomBefore)
})
