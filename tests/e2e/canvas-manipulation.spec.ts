import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'
import { getSelectedIds, getPageChildren, getSelectedNode, getNodeById } from '../helpers/store'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
})

test.afterAll(async () => {
  await page.close()
})

test('marquee selects two rectangles', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 80, 80)
  await canvas.drawRect(250, 100, 80, 80)
  await canvas.pressKey('Escape')
  await canvas.waitForRender()

  await canvas.marquee(70, 70, 370, 230)

  const count = await getSelectedIds(page)
  expect(count).toBe(2)
  canvas.assertNoErrors()
})

test('marquee on empty area deselects', async () => {
  await canvas.click(140, 140)
  await canvas.waitForRender()
  expect(await getSelectedIds(page)).toBeGreaterThan(0)

  await canvas.marquee(500, 450, 620, 570)

  const count = await getSelectedIds(page)
  expect(count).toBe(0)
  canvas.assertNoErrors()
})

test('Alt+drag duplicate increases child count', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 80, 80)
  await canvas.click(140, 140)
  await canvas.waitForRender()

  const before = (await getPageChildren(page)).length

  await canvas.altDrag(140, 140, 280, 140)

  const after = (await getPageChildren(page)).length
  expect(after).toBe(before + 1)
  canvas.assertNoErrors()
})

test('duplicate shortcut Cmd+D increases child count', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 80, 80)
  await canvas.click(240, 240)
  await canvas.waitForRender()

  const before = (await getPageChildren(page)).length

  await canvas.pressKey('Meta+d')
  await canvas.waitForRender()

  const after = (await getPageChildren(page)).length
  expect(after).toBe(before + 1)
  canvas.assertNoErrors()
})

test('resize corner handle drag increases node dimensions', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 100, 100)
  await canvas.click(150, 150)
  await canvas.waitForRender()

  const before = await getSelectedNode(page)
  expect(before).not.toBeNull()

  const viewport = await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const id = [...store.state.selectedIds][0]
    const n = store.graph.getNode(id)
    if (!n) return null
    const abs = store.graph.getAbsolutePosition(id)
    const zoom = store.state.zoom
    const panX = store.state.panX
    const panY = store.state.panY
    return {
      handleX: (abs.x + n.width) * zoom + panX,
      handleY: (abs.y + n.height) * zoom + panY,
    }
  })
  expect(viewport).not.toBeNull()

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('No canvas')

  const hx = box.x + viewport!.handleX
  const hy = box.y + viewport!.handleY

  await page.mouse.move(hx, hy)
  await page.mouse.down()
  await page.mouse.move(hx + 50, hy + 50, { steps: 10 })
  await page.mouse.up()
  await canvas.waitForRender()

  const after = await getSelectedNode(page)
  expect(after!.width).toBeGreaterThan(before!.width + 20)
  expect(after!.height).toBeGreaterThan(before!.height + 20)
  canvas.assertNoErrors()
})

test('rotation handle drag rotates node', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 100, 100)
  await canvas.click(250, 250)
  await canvas.waitForRender()

  const before = await getSelectedNode(page)
  expect(before).not.toBeNull()
  const initialRotation = before!.rotation ?? 0

  const viewport = await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const id = [...store.state.selectedIds][0]
    const n = store.graph.getNode(id)
    if (!n) return null
    const abs = store.graph.getAbsolutePosition(id)
    const zoom = store.state.zoom
    const panX = store.state.panX
    const panY = store.state.panY
    const cx = (abs.x + n.width / 2) * zoom + panX
    const cy = (abs.y + n.height / 2) * zoom + panY
    const topMidY = abs.y * zoom + panY
    return { cx, cy, topMidY }
  })
  expect(viewport).not.toBeNull()

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('No canvas')

  const rx = box.x + viewport!.cx
  const ry = box.y + viewport!.topMidY - 24

  const nodeId = before!.id

  await page.mouse.move(rx, ry)
  await canvas.waitForRender()
  await page.mouse.down()
  await page.mouse.move(rx + 60, ry + 60, { steps: 15 })
  await page.mouse.up()
  await canvas.waitForRender()

  const after = await getNodeById(page, nodeId)
  expect(after!.rotation ?? 0).not.toBe(initialRotation)
  canvas.assertNoErrors()
})

test('hover highlight changes canvas rendering', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 100, 100)
  await canvas.pressKey('Escape')
  await canvas.waitForRender()

  const noHoverShot = await canvas.screenshotCanvas()

  await canvas.hover(250, 250)

  const hoverShot = await canvas.screenshotCanvas()

  expect(Buffer.compare(noHoverShot, hoverShot)).not.toBe(0)
  canvas.assertNoErrors()
})
