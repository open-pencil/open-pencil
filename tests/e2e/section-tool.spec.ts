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

test('draw section in full editor without browser errors', async () => {
  await canvas.drawSection(100, 100, 240, 160)

  await expect(page.locator('[data-test-id="design-node-header"]')).toContainText('SECTION')
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const store = window.__OPEN_PENCIL_STORE__
        const selectedId = [...store.state.selectedIds][0]
        return selectedId ? store.graph.getNode(selectedId)?.type : null
      })
    })
    .toBe('SECTION')

  canvas.assertNoErrors()
})
