import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

test.beforeEach(async () => {
  await canvas.clearCanvas()
})

async function rectangleCount() {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return [...store.graph.nodes.values()].filter((node) => node.type === 'RECTANGLE').length
  })
}

test('undo after option-drag duplicate removes the copy', async () => {
  await canvas.drawRect(120, 120, 120, 90)
  await expect.poll(rectangleCount).toBe(1)

  await canvas.altDrag(180, 165, 340, 165)
  await expect.poll(rectangleCount).toBe(2)

  await canvas.undo()
  await expect.poll(rectangleCount).toBe(1)

  await page.waitForTimeout(1500)
  await expect.poll(rectangleCount).toBe(1)
  canvas.assertNoErrors()
})
