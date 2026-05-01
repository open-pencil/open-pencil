import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'
import { getSelectedNode, getNodeById } from '../helpers/store'

let page: Page
let canvas: CanvasHelper
let frameId: string

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

async function selectFrame() {
  expect(frameId, 'frameId must be set — did the Shift+A test run?').toBeTruthy()
  await page.evaluate((id: string) => {
    window.__OPEN_PENCIL_STORE__!.select([id])
  }, frameId)
  await canvas.waitForRender()
}

test('Shift+A wraps selection in auto-layout frame', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 60, 60)
  await canvas.drawRect(220, 100, 60, 60)
  await canvas.pressKey('Meta+a')
  await canvas.waitForRender()

  await canvas.pressKey('Shift+A')
  await canvas.waitForRender()

  const node = await getSelectedNode(page)
  expect(node).not.toBeNull()
  expect(node!.type).toBe('FRAME')
  expect(node!.layoutMode).not.toBe('NONE')
  expect(node!.childIds.length).toBe(2)

  frameId = node!.id
  canvas.assertNoErrors()
})

test('direction button toggles to VERTICAL', async () => {
  await selectFrame()

  await page.locator('[data-test-id="layout-direction-vertical"]').click()
  await canvas.waitForRender()

  const frame = await getNodeById(page, frameId)
  expect(frame!.layoutMode).toBe('VERTICAL')
  canvas.assertNoErrors()
})

test('gap ScrubInput sets itemSpacing', async () => {
  await selectFrame()
  const before = await getNodeById(page, frameId)
  const initialSpacing = before!.itemSpacing

  await canvas.dragScrubInput(page.locator('[data-test-id="layout-gap-input"]'), 40)

  const after = await getNodeById(page, frameId)
  expect(after!.itemSpacing).toBeGreaterThan(initialSpacing + 5)
  canvas.assertNoErrors()
})

test('gap menu sets auto space-between alignment', async () => {
  await selectFrame()

  await page.locator('[data-test-id="layout-gap-menu"]').click()
  await page.getByRole('option', { name: 'Auto' }).click()
  await canvas.waitForRender()

  let frame = await getNodeById(page, frameId)
  expect(frame!.primaryAxisAlign).toBe('SPACE_BETWEEN')
  await expect(page.locator('[data-test-id="layout-alignment-grid"] button')).toHaveCount(9)

  await page.locator('[data-test-id="layout-gap-menu"]').click()
  await page.getByRole('option', { name: String(Math.round(frame!.itemSpacing)) }).click()
  await canvas.waitForRender()

  frame = await getNodeById(page, frameId)
  expect(frame!.primaryAxisAlign).toBe('MIN')
  await expect(page.locator('[data-test-id="layout-alignment-grid"] button')).toHaveCount(9)
  canvas.assertNoErrors()
})

test('wrap mode exposes cross-axis gap control', async () => {
  await selectFrame()

  await page.locator('[data-test-id="layout-direction-wrap"]').click()
  await canvas.waitForRender()

  const before = await getNodeById(page, frameId)
  const initialSpacing = before!.counterAxisSpacing
  await canvas.dragScrubInput(page.locator('[data-test-id="layout-cross-gap-input"]'), 40)

  const after = await getNodeById(page, frameId)
  expect(after!.layoutWrap).toBe('WRAP')
  expect(after!.counterAxisSpacing).toBeGreaterThan(initialSpacing + 5)
  canvas.assertNoErrors()
})

test('uniform padding ScrubInput sets all four padding sides', async () => {
  await selectFrame()

  const paddingScrub = page.locator('[data-test-id="layout-uniform-padding-input"]')
  await paddingScrub.click()
  await canvas.waitForRender()
  const paddingInput = page.locator(
    '[data-test-id="layout-uniform-padding-input"] [data-test-id="scrub-input-field"]'
  )
  await paddingInput.fill('16')
  await paddingInput.press('Enter')
  await canvas.waitForRender()

  const frame = await getNodeById(page, frameId)
  expect(frame!.paddingTop).toBe(16)
  expect(frame!.paddingRight).toBe(16)
  expect(frame!.paddingBottom).toBe(16)
  expect(frame!.paddingLeft).toBe(16)
  canvas.assertNoErrors()
})

test('size dropdown adds and removes min width', async () => {
  await selectFrame()

  await page.locator('[data-test-id="layout-width-sizing-menu"]').click()
  await page.getByText('Add min width').click()
  await canvas.waitForRender()

  let frame = await getNodeById(page, frameId)
  expect(frame!.minWidth).toBe(Math.round(frame!.width))
  await expect(page.locator('[data-test-id="layout-min-width-input"]')).toBeVisible()

  await page.locator('[data-test-id="layout-width-sizing-menu"]').click()
  await page.getByText('Remove min width').click()
  await canvas.waitForRender()

  frame = await getNodeById(page, frameId)
  expect(frame!.minWidth).toBeNull()
  await expect(page.locator('[data-test-id="layout-min-width-input"]')).toHaveCount(0)
  canvas.assertNoErrors()
})

test('alignment grid center sets CENTER alignment', async () => {
  await selectFrame()

  const centerCell = page.locator('[data-test-id="layout-alignment-grid"] button').nth(4)
  await centerCell.click()
  await canvas.waitForRender()

  const frame = await getNodeById(page, frameId)
  expect(frame!.primaryAxisAlign).toBe('CENTER')
  expect(frame!.counterAxisAlign).toBe('CENTER')
  canvas.assertNoErrors()
})

test('remove auto-layout sets layoutMode to NONE', async () => {
  await selectFrame()

  await page.locator('[data-test-id="layout-remove-auto"]').click()
  await canvas.waitForRender()

  const frame = await getNodeById(page, frameId)
  expect(frame!.layoutMode).toBe('NONE')
  canvas.assertNoErrors()
})
