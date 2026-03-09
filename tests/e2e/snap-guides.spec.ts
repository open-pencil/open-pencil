import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'

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
    const store = window.__OPEN_PENCIL_STORE__!
    store.createShape('RECTANGLE', 100, 100, 80, 80)
    const b = store.createShape('RECTANGLE', 300, 100, 80, 80)
    store.select([b])
  })
  await canvas.waitForRender()
}

// Snap guide visual tests compare the canvas at a snap position vs a non-snap position
// during the same drag. The snap position produces a guide line overlay; non-snap does not.
// Skipped on Linux CI due to X11 Alt+drag interference and rendering differences.

test('edge snap guide: canvas differs at snap vs non-snap position', async () => {
  test.skip(process.platform === 'linux', 'Snap guide visual tests skipped on Linux CI')

  await createRects()

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('No canvas')

  // drag to a non-snap position first, capture screenshot
  await page.mouse.move(box.x + 340, box.y + 140)
  await page.mouse.down()
  await page.mouse.move(box.x + 250, box.y + 140, { steps: 15 })
  const nonSnapShot = await canvas.screenshotCanvas()

  // continue drag to edge-snap position (right edge of rect B aligns with left edge of rect A at x=180)
  await page.mouse.move(box.x + 182, box.y + 140, { steps: 15 })
  const snapShot = await canvas.screenshotCanvas()

  await page.mouse.up()

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

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('No canvas')

  // drag to a non-snap position first
  await page.mouse.move(box.x + 340, box.y + 140)
  await page.mouse.down()
  await page.mouse.move(box.x + 260, box.y + 140, { steps: 15 })
  const nonSnapShot = await canvas.screenshotCanvas()

  // continue drag to center-snap position (center of rect B aligns with center of rect A)
  await page.mouse.move(box.x + 220, box.y + 140, { steps: 15 })
  const snapShot = await canvas.screenshotCanvas()

  await page.mouse.up()

  expect(
    Buffer.compare(nonSnapShot, snapShot),
    'Canvas should differ at snap position due to center guide line overlay'
  ).not.toBe(0)
  canvas.assertNoErrors()
})
