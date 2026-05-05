import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test&no-chrome')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

test.beforeEach(async () => {
  await canvas.clearCanvas()
})

async function expectCanvas(name: string) {
  canvas.assertNoErrors()
  const buffer = await canvas.canvas.screenshot()
  expect(buffer).toMatchSnapshot(`${name}.png`)
}

test('empty canvas', async () => {
  await expectCanvas('empty-canvas')
})

test('draw rectangle', async () => {
  await canvas.drawRect(100, 100, 200, 150)
  await expectCanvas('draw-rectangle')
})

test('draw ellipse', async () => {
  await canvas.drawEllipse(100, 100, 200, 150)
  await expectCanvas('draw-ellipse')
})

test('draw rectangle then move it', async () => {
  await canvas.drawRect(100, 100, 200, 150)
  await canvas.selectTool('select')
  await canvas.drag(200, 175, 400, 300)
  await canvas.waitForRender()
  await expectCanvas('draw-rectangle-then-move-it')
})

test('draw and delete', async () => {
  await canvas.drawRect(100, 100, 200, 150)
  await canvas.deleteSelection()
  await expectCanvas('draw-and-delete')
})

test('draw and undo', async () => {
  await canvas.drawRect(100, 100, 200, 150)
  await canvas.undo()
  await expectCanvas('draw-and-undo')
})
