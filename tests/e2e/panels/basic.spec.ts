import { test, expect, type Page } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

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
  const panel = page.getByTestId('layers-panel')
  const before = await panel.boundingBox()
  expect(before).not.toBeNull()

  const handle = page.getByTestId('left-splitter-handle')
  const handleBox = await handle.boundingBox()
  expect(handleBox).not.toBeNull()

  const handleBounds = expectDefined(handleBox, 'splitter handle bounds')
  const beforeBounds = expectDefined(before, 'layers panel bounds')
  const cx = handleBounds.x + handleBounds.width / 2
  const cy = handleBounds.y + handleBounds.height / 2

  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 80, cy, { steps: 10 })
  await page.mouse.up()
  await canvas.waitForRender()

  const after = expectDefined(await panel.boundingBox(), 'resized layers panel bounds')
  expect(after.width).toBeGreaterThan(beforeBounds.width + 40)
  canvas.assertNoErrors()
})

test('panel width persists after page reload', async () => {
  // Allow Reka's auto-save debounce to flush before recording the width
  await page.waitForTimeout(300)
  const recordedWidth = expectDefined(
    await page.getByTestId('layers-panel').boundingBox(),
    'persisted layers panel bounds'
  ).width

  await page.reload()
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  const after = expectDefined(
    await page.getByTestId('layers-panel').boundingBox(),
    'reloaded layers panel bounds'
  )
  expect(Math.abs(after.width - recordedWidth)).toBeLessThanOrEqual(2)
  canvas.assertNoErrors()
})

test('Cmd+Backslash hides panels', async () => {
  await page.keyboard.press('Meta+\\')
  await canvas.waitForRender()

  await expect(page.getByTestId('layers-panel')).not.toBeVisible()
  canvas.assertNoErrors()
})

test('Cmd+Backslash shows panels again', async () => {
  await page.keyboard.press('Meta+\\')
  await canvas.waitForRender()

  await expect(page.getByTestId('layers-panel')).toBeVisible()
  canvas.assertNoErrors()
})
