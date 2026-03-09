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
})

test.afterAll(async () => {
  await page.close()
})

test('layers panel resize increases width', async () => {
  const panel = page.locator('[data-test-id="layers-panel"]')
  const before = await panel.boundingBox()
  expect(before).not.toBeNull()

  const handle = page.locator('[data-test-id="left-splitter-handle"]')
  const handleBox = await handle.boundingBox()
  expect(handleBox).not.toBeNull()

  const cx = handleBox!.x + handleBox!.width / 2
  const cy = handleBox!.y + handleBox!.height / 2

  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 80, cy, { steps: 10 })
  await page.mouse.up()
  await canvas.waitForRender()

  const after = await panel.boundingBox()
  expect(after!.width).toBeGreaterThan(before!.width + 40)
  canvas.assertNoErrors()
})

test('panel width persists after page reload', async () => {
  const recordedWidth = (await page.locator('[data-test-id="layers-panel"]').boundingBox())!.width

  await page.reload()
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  const after = await page.locator('[data-test-id="layers-panel"]').boundingBox()
  expect(Math.abs(after!.width - recordedWidth)).toBeLessThanOrEqual(2)
  canvas.assertNoErrors()
})

test('Cmd+Backslash hides panels', async () => {
  await page.keyboard.press('Meta+\\')
  await canvas.waitForRender()

  await expect(page.locator('[data-test-id="layers-panel"]')).not.toBeVisible()
  canvas.assertNoErrors()
})

test('Cmd+Backslash shows panels again', async () => {
  await page.keyboard.press('Meta+\\')
  await canvas.waitForRender()

  await expect(page.locator('[data-test-id="layers-panel"]')).toBeVisible()
  canvas.assertNoErrors()
})
