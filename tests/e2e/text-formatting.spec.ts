import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'
import { getSelectedNode, getEditingTextId, getNodeById } from '../helpers/store'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const id = store.createShape('TEXT', 200, 200, 150, 30)
    store.graph.updateNode(id, { text: 'Hello World', fontSize: 18 })
    store.select([id])
  })
  await canvas.waitForRender()
  await canvas.pressKey('Escape')
  await canvas.waitForRender()
})

test.afterAll(async () => {
  await page.close()
})

test('double-click enters text edit mode', async () => {
  await canvas.dblclick(275, 215)
  await page.waitForTimeout(200)

  const editingId = await getEditingTextId(page)
  expect(editingId).not.toBeNull()
  canvas.assertNoErrors()
})

test('bold button toggles fontWeight to 700 then back to 400', async () => {
  await canvas.pressKey('Escape')
  await canvas.waitForRender()
  await canvas.click(275, 215)
  await canvas.waitForRender()

  const nodeId = (await getSelectedNode(page))!.id

  // ensure starting weight is 400 via undo-safe store method
  await page.evaluate(async (id: string) => {
    const store = window.__OPEN_PENCIL_STORE__!
    store.updateNodeWithUndo(id, { fontWeight: 400 }, 'reset')
    store.state.sceneVersion++
    await new Promise(requestAnimationFrame)
  }, nodeId)
  await canvas.waitForRender()

  const boldBtn = page.locator('[data-test-id="typography-bold-button"]')
  await expect(boldBtn).toBeVisible({ timeout: 3000 })
  await boldBtn.click()
  await page.waitForTimeout(500)
  await canvas.waitForRender()

  const bold = await getNodeById(page, nodeId)
  expect(bold!.fontWeight).toBe(700)

  await page.locator('[data-test-id="typography-bold-button"]').click()
  await page.waitForTimeout(500)
  await canvas.waitForRender()

  const normal = await getNodeById(page, nodeId)
  expect(normal!.fontWeight).toBe(400)
  canvas.assertNoErrors()
})

test('Cmd+I toggles italic', async () => {
  await canvas.click(275, 215)
  await canvas.waitForRender()
  const nodeId = (await getSelectedNode(page))!.id

  await canvas.dblclick(275, 215)
  await expect.poll(() => getEditingTextId(page), { timeout: 5000 }).toBeTruthy()

  await page.keyboard.press('End')
  await page.keyboard.press('Meta+i')
  await canvas.pressKey('Escape')
  await canvas.waitForRender()

  const node = await getNodeById(page, nodeId)
  expect(node!.italic).toBe(true)
  canvas.assertNoErrors()
})

test('double-click word select changes canvas screenshot', async () => {
  await canvas.pressKey('Escape')
  await canvas.waitForRender()

  const baseline = await canvas.screenshotCanvas()

  await canvas.dblclick(275, 215)
  await page.waitForTimeout(200)

  const selected = await canvas.screenshotCanvas()

  expect(Buffer.compare(baseline, selected)).not.toBe(0)
  await canvas.pressKey('Escape')
  await canvas.waitForRender()
  canvas.assertNoErrors()
})

test('Alt+ArrowRight word navigation stays in text edit mode', async () => {
  await canvas.dblclick(275, 215)
  await page.waitForTimeout(200)

  await page.keyboard.press('Alt+ArrowRight')
  await canvas.waitForRender()

  const editingId = await getEditingTextId(page)
  expect(editingId).not.toBeNull()
  canvas.assertNoErrors()
})
