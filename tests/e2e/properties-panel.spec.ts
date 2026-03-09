import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'
import { getSelectedNode, getPageChildren } from '../helpers/store'

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

test('ScrubInput drag changes X position', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 80, 80)
  const before = await getSelectedNode(page)
  expect(before).not.toBeNull()
  const initialX = before!.x

  const xScrub = page.locator('[data-test-id="position-section"] [data-test-id="scrub-input"]').first()
  await canvas.dragScrubInput(xScrub, 50)

  const after = await getSelectedNode(page)
  expect(after!.x).not.toBe(initialX)
  canvas.assertNoErrors()
})

test('corner radius uniform sets cornerRadius', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 80, 80)

  const scrubContainer = page.locator('[data-test-id="corner-radius-input"]')
  await scrubContainer.click()
  await canvas.waitForRender()
  const input = page.locator('[data-test-id="corner-radius-input"] [data-test-id="scrub-input-field"]')
  await input.fill('12')
  await input.press('Enter')
  await canvas.waitForRender()

  const node = await getSelectedNode(page)
  expect(node!.cornerRadius).toBe(12)
  canvas.assertNoErrors()
})

test('independent corners toggle shows four corner inputs', async () => {
  await page.locator('[data-test-id="independent-corners-toggle"]').click()
  await canvas.waitForRender()

  await expect(page.locator('[data-test-id="corner-tl-input"]')).toBeVisible()
  await expect(page.locator('[data-test-id="corner-tr-input"]')).toBeVisible()
  await expect(page.locator('[data-test-id="corner-br-input"]')).toBeVisible()
  await expect(page.locator('[data-test-id="corner-bl-input"]')).toBeVisible()
  canvas.assertNoErrors()
})

test('fill gradient switch changes fill type', async () => {
  await canvas.clearCanvas()
  await canvas.pressKey('Escape')
  await canvas.waitForRender()
  // fresh rect with default solid fill
  await canvas.drawRect(300, 300, 80, 80)
  await canvas.waitForRender()

  await expect(page.locator('[data-test-id="fill-section"]')).toBeVisible({ timeout: 5000 })

  const fillItem = page.locator('[data-test-id="fill-item"]').first()
  await expect(fillItem).toBeVisible({ timeout: 5000 })
  const fillSwatch = fillItem.locator('[data-test-id="fill-picker-swatch"]')
  await expect(fillSwatch).toBeVisible({ timeout: 5000 })
  await fillSwatch.click()
  await canvas.waitForRender()

  await page.locator('[data-test-id="fill-picker-tab-gradient"]').click()
  await canvas.waitForRender()

  const node = await getSelectedNode(page)
  expect(node!.fills[0].type).toBe('GRADIENT_LINEAR')
  canvas.assertNoErrors()
})

test('variable bind badge appears on fill', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 80, 80)

  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const col = store.graph.createCollection('Colors')
    const v = store.graph.createVariable('brand-red', 'COLOR', col.id, { r: 1, g: 0, b: 0, a: 1 })
    const id = [...store.state.selectedIds][0]
    if (!id) return
    store.graph.bindVariable(id, 'fills/0/color', v.id)
    store.state.sceneVersion++
  })
  await canvas.waitForRender()

  await expect(page.locator('[data-test-id="fill-unbind-variable"]')).toBeVisible()
  canvas.assertNoErrors()
})

test('alignment buttons align nodes to same X', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(50, 200, 60, 60)
  await canvas.drawRect(250, 200, 60, 60)
  await canvas.pressKey('Meta+a')
  await canvas.waitForRender()

  await page.locator('[data-test-id="position-align-left"]').click()
  await canvas.waitForRender()

  const children = await getPageChildren(page)
  expect(children.length).toBe(2)
  expect(children[0].x).toBe(children[1].x)
  canvas.assertNoErrors()
})

test('flip horizontal sets flipX', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 80, 80)

  await page.locator('[data-test-id="position-flip-horizontal"]').click()
  await canvas.waitForRender()

  const node = await getSelectedNode(page)
  expect(node!.flipX).toBe(true)
  canvas.assertNoErrors()
})

test('clip content checkbox toggles clipsContent', async () => {
  await canvas.clearCanvas()
  await canvas.pressKey('f')
  await canvas.drag(100, 100, 300, 300)
  await canvas.waitForRender()

  const before = await getSelectedNode(page)
  const initialValue = before!.clipsContent

  await page.locator('[data-test-id="clip-content-checkbox"]').click()
  await canvas.waitForRender()

  const after = await getSelectedNode(page)
  expect(after!.clipsContent).toBe(!initialValue)
  canvas.assertNoErrors()
})
