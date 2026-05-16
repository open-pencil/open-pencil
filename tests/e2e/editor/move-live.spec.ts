import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test&no-chrome&no-rulers')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

test.beforeEach(async () => {
  await canvas.clearCanvas()
})

test('scene canvas repaints selected node during drag', async () => {
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('RECTANGLE', 120, 120, 80, 80)
    store.updateNode(id, {
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.45, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.select([id])
  })
  await canvas.waitForRender()

  const sceneCanvas = page.getByTestId('scene-canvas-element')
  const beforeDrag = await sceneCanvas.screenshot()
  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('No canvas')

  await page.mouse.move(box.x + 160, box.y + 160)
  await page.mouse.down()
  await page.mouse.move(box.x + 260, box.y + 160, { steps: 12 })
  await canvas.waitForRender()
  const duringDrag = await sceneCanvas.screenshot()
  await page.mouse.up()

  expect(Buffer.compare(beforeDrag, duringDrag)).not.toBe(0)
  canvas.assertNoErrors()
})
