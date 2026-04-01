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

async function setupFrameChild(rotation: number) {
  await canvas.clearCanvas()

  const setup = await page.evaluate((frameRotation) => {
    const store = window.__OPEN_PENCIL_STORE__!
    const frameId = store.createShape('FRAME', 180, 160, 240, 160)
    if (!frameId) return null
    store.updateNode(frameId, { rotation: frameRotation })
    const rectId = store.createShape('RECTANGLE', 245, 205, 60, 40)
    if (!rectId) return null
    store.graph.reparentNode(rectId, frameId)
    store.updateNode(rectId, { x: 65, y: 45 })
    store.select([])
    store.requestRender()
    return { frameId, rectId }
  }, rotation)

  expect(setup).not.toBeNull()
  await canvas.waitForRender()

  const state = await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const pageId = store.state.currentPageId
    const pageNode = store.graph.getNode(pageId)
    const frame = pageNode?.childIds
      .map((id: string) => store.graph.getNode(id))
      .find((node: { type: string } | undefined) => node?.type === 'FRAME')
    if (!frame) return null
    const child = frame.childIds
      .map((childId: string) => store.graph.getNode(childId))
      .find((node: { type: string } | undefined) => node?.type === 'RECTANGLE')
    if (!child) return null
    const abs = store.graph.getAbsolutePosition(frame.id)
    const cx = abs.x + frame.width / 2
    const cy = abs.y + frame.height / 2
    const childCx = abs.x + child.x + child.width / 2
    const childCy = abs.y + child.y + child.height / 2
    const rad = (frame.rotation * Math.PI) / 180
    const dx = childCx - cx
    const dy = childCy - cy
    return {
      childId: child.id,
      hitX: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
      hitY: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
      missX: abs.x + 20,
      missY: abs.y + 20,
    }
  })

  expect(state).not.toBeNull()
  return state!
}

test('frame children keep correct hover and click hit area without rotation', async () => {
  const state = await setupFrameChild(0)

  await canvas.hover(state.hitX, state.hitY)
  const hoveredId = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.hoveredNodeId)
  expect(hoveredId).toBe(state.childId)

  await canvas.click(state.hitX, state.hitY)
  await canvas.waitForRender()
  const selected = await getSelectedNode(page)
  expect(selected?.id).toBe(state.childId)

  await canvas.hover(state.missX, state.missY)
  const hoveredMiss = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.hoveredNodeId)
  expect(hoveredMiss).not.toBe(state.childId)
  canvas.assertNoErrors()
})

test('rotated frame children keep correct hover and click hit area', async () => {
  const state = await setupFrameChild(35)

  await canvas.hover(state.hitX, state.hitY)
  const hoveredId = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.hoveredNodeId)
  expect(hoveredId).toBe(state.childId)

  await canvas.click(state.hitX, state.hitY)
  await canvas.waitForRender()
  const selected = await getSelectedNode(page)
  expect(selected?.id).toBe(state.childId)

  await canvas.hover(state.missX, state.missY)
  const hoveredMiss = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.hoveredNodeId)
  expect(hoveredMiss).not.toBe(state.childId)
  canvas.assertNoErrors()
})

 test('rotation drag exposes live rotation preview state', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 100, 100)
  await canvas.click(250, 250)
  await canvas.waitForRender()

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
    const topMidY = abs.y * zoom + panY
    return { cx, topMidY }
  })
  expect(viewport).not.toBeNull()

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('No canvas')

  const rx = box.x + viewport!.cx
  const ry = box.y + viewport!.topMidY - 24

  await page.mouse.move(rx, ry)
  await canvas.waitForRender()
  await page.mouse.down()
  await page.mouse.move(rx + 60, ry + 60, { steps: 15 })
  await canvas.waitForRender()

  const preview = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.rotationPreview)
  expect(preview).not.toBeNull()

  await page.mouse.up()
  await canvas.waitForRender()

  const clearedPreview = await page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.rotationPreview)
  expect(clearedPreview).toBeNull()
  canvas.assertNoErrors()
})
