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

function getSelectedNode() {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const n = store.graph.getNode(id)
    if (!n) return null
    return {
      id: n.id,
      type: n.type,
      name: n.name,
      text: n.text,
      fontSize: n.fontSize,
      fontFamily: n.fontFamily,
      fontWeight: n.fontWeight,
      width: n.width,
      height: n.height
    }
  })
}

function getPageChildren() {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return store.graph.getChildren(store.state.currentPageId).map((n) => ({
      type: n.type,
      name: n.name,
      text: n.text
    }))
  })
}

test('pressing T activates text tool', async () => {
  await page.keyboard.press('t')

  const tool = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.activeTool)
  expect(tool).toBe('TEXT')
})

test('clicking with text tool creates a text node', async () => {
  await canvas.click(200, 200)
  await canvas.waitForRender()

  // Wait a tick for text editing mode to activate
  await page.waitForTimeout(200)

  const children = await getPageChildren()
  const textNode = children.find((c) => c.type === 'TEXT')
  expect(textNode).toBeTruthy()
})

test('text node is selected after creation', async () => {
  const node = await getSelectedNode()
  expect(node).toBeTruthy()
  expect(node!.type).toBe('TEXT')
})

test('typography section appears for text node', async () => {
  // Exit text editing mode
  await page.keyboard.press('Escape')
  await canvas.waitForRender()

  // Re-select the text node
  await canvas.click(200, 200)
  await canvas.waitForRender()

  const typoSection = page.locator('[data-test-id="typography-section"]')
  await expect(typoSection).toBeVisible()
})

test('text node has default font properties', async () => {
  const node = await getSelectedNode()
  expect(node).toBeTruthy()
  expect(node!.fontSize).toBeGreaterThan(0)
  expect(node!.fontFamily).toBeTruthy()
})

test('creating text via store works', async () => {
  await page.keyboard.press('Escape')
  await canvas.waitForRender()

  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const id = store.createShape('TEXT', 100, 300, 200, 30)
    store.graph.updateNode(id, { text: 'Hello World', fontSize: 24, fontFamily: 'Inter' })
    store.select([id])
  })
  await canvas.waitForRender()

  const node = await getSelectedNode()
  expect(node!.text).toBe('Hello World')
  expect(node!.fontSize).toBe(24)
})

test('undo removes text node', async () => {
  const beforeCount = (await getPageChildren()).length

  await canvas.undo()
  await canvas.waitForRender()

  const afterCount = (await getPageChildren()).length
  expect(afterCount).toBe(beforeCount - 1)
})

test('frame tool creates FRAME node', async () => {
  await page.keyboard.press('f')
  await canvas.drag(400, 100, 600, 250)
  await canvas.waitForRender()

  const node = await getSelectedNode()
  expect(node!.type).toBe('FRAME')
  expect(node!.width).toBeGreaterThan(0)
  expect(node!.height).toBeGreaterThan(0)

  canvas.assertNoErrors()
})
