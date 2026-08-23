import { test, expect, type Page } from '@playwright/test'

import type { Vector } from '@open-pencil/scene-graph/primitives'

import { CanvasHelper } from '#tests/helpers/canvas'

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

async function createRects() {
  await canvas.clearCanvas()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.snappingPreferences = { geometry: true, objects: true, pixelGrid: false }
    store.createShape('RECTANGLE', 100, 100, 80, 80)
    const b = store.createShape('RECTANGLE', 300, 100, 80, 80)
    store.select([b])
  })
  await canvas.waitForRender()
}

async function selectedPosition(): Promise<Vector> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.state.selectedIds.values().next().value
    const node = id ? store.graph.getNode(id) : undefined
    if (!node) throw new Error('Selected node not found')
    return { x: node.x, y: node.y }
  })
}

async function snapGuides() {
  return page.evaluate(() => window.openPencil?.getStore?.().state.snapGuides ?? [])
}

// Snap guide visual tests compare the canvas at a snap position vs a non-snap position
// during the same drag. The snap position produces a guide line overlay; non-snap does not.
// Skipped on Linux CI due to X11 Alt+drag interference and rendering differences.

test('edge snap guide: canvas differs at snap vs non-snap position', async () => {
  test.skip(process.platform === 'linux', 'Snap guide visual tests skipped on Linux CI')

  await createRects()

  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('No canvas')

  // Drag near the target's right edge. The moving left edge lands at x=182,
  // then snaps to the target's right edge at x=180.
  await page.mouse.move(box.x + 340, box.y + 140)
  await page.mouse.down()
  await page.mouse.move(box.x + 230, box.y + 140, { steps: 15 })
  const nonSnapShot = await canvas.screenshotCanvas()

  await page.mouse.move(box.x + 222, box.y + 140, { steps: 15 })
  expect(await selectedPosition()).toEqual({ x: 180, y: 100 })
  expect(await snapGuides()).toContainEqual({ axis: 'x', position: 180, from: 100, to: 180 })
  const snapShot = await canvas.screenshotCanvas()

  await page.mouse.up()
  expect(await selectedPosition()).toEqual({ x: 180, y: 100 })
  expect(await snapGuides()).toEqual([])

  // At snap position the guide line overlay should make the canvas visually different
  expect(
    Buffer.compare(nonSnapShot, snapShot),
    'Canvas should differ at snap position due to guide line overlay'
  ).not.toBe(0)
  canvas.assertNoErrors()
})

test('center snap guide: canvas differs at snap vs non-snap position', async () => {
  test.skip(process.platform === 'linux', 'Snap guide visual tests skipped on Linux CI')

  await createRects()

  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('No canvas')

  // Move the selected center near the target center at x=140.
  await page.mouse.move(box.x + 340, box.y + 140)
  await page.mouse.down()
  await page.mouse.move(box.x + 150, box.y + 140, { steps: 15 })
  const nonSnapShot = await canvas.screenshotCanvas()

  await page.mouse.move(box.x + 142, box.y + 140, { steps: 15 })
  expect(await selectedPosition()).toEqual({ x: 100, y: 100 })
  expect(await snapGuides()).toContainEqual({ axis: 'x', position: 140, from: 100, to: 180 })
  const snapShot = await canvas.screenshotCanvas()

  await page.mouse.up()
  expect(await selectedPosition()).toEqual({ x: 100, y: 100 })
  expect(await snapGuides()).toEqual([])

  expect(
    Buffer.compare(nonSnapShot, snapShot),
    'Canvas should differ at snap position due to center guide line overlay'
  ).not.toBe(0)
  canvas.assertNoErrors()
})

test('pixel snapping preference controls fractional object movement', async () => {
  await canvas.clearCanvas()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: false }
    const id = store.createShape('RECTANGLE', 120.25, 100.25, 80, 80)
    store.select([id])
  })
  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('No canvas')

  await page.mouse.move(box.x + 160.25, box.y + 140.25)
  await page.mouse.down()
  await page.mouse.move(box.x + 166.55, box.y + 147.65, { steps: 5 })
  await page.mouse.up()
  expect(await selectedPosition()).toEqual({ x: 126.25, y: 107.25 })

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.snappingPreferences.pixelGrid = true
  })
  await page.mouse.move(box.x + 166.25, box.y + 147.25)
  await page.mouse.down()
  await page.mouse.move(box.x + 172.8, box.y + 155.05, { steps: 5 })
  await page.mouse.up()
  expect(await selectedPosition()).toEqual({ x: 133, y: 115 })
  canvas.assertNoErrors()
})

test('Control bypasses object and pixel snapping during a real pointer drag', async () => {
  await canvas.clearCanvas()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.snappingPreferences = { geometry: true, objects: true, pixelGrid: true }
    store.createShape('RECTANGLE', 100, 100, 80, 80)
    const id = store.createShape('RECTANGLE', 300, 100, 80, 80)
    store.select([id])
  })
  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('No canvas')

  await page.mouse.move(box.x + 340, box.y + 140)
  await page.mouse.down()
  await page.keyboard.down('Control')
  await page.mouse.move(box.x + 222.4, box.y + 147.3, { steps: 10 })
  expect(await selectedPosition()).toEqual({ x: 182, y: 107 })
  expect(await snapGuides()).toEqual([])
  await page.keyboard.up('Control')
  await page.mouse.up()
  expect(await selectedPosition()).toEqual({ x: 182, y: 107 })
  canvas.assertNoErrors()
})
