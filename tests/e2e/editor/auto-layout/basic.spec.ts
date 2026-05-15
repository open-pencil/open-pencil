import { test, expect, type Page } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'
import { getSelectedNode, getNodeById } from '#tests/helpers/store'

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
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.select([id])
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
  expect(expectDefined(node, 'node').type).toBe('FRAME')
  expect(expectDefined(node, 'node').layoutMode).not.toBe('NONE')
  expect(expectDefined(node, 'node').childIds.length).toBe(2)

  frameId = expectDefined(node, 'node').id
  canvas.assertNoErrors()
})

test('direction button toggles to VERTICAL', async () => {
  await selectFrame()

  await page.getByTestId('layout-direction-vertical').click()
  await canvas.waitForRender()

  const frame = await getNodeById(page, frameId)
  expect(expectDefined(frame, 'frame').layoutMode).toBe('VERTICAL')
  canvas.assertNoErrors()
})

test('gap ScrubInput sets itemSpacing', async () => {
  await selectFrame()
  const before = await getNodeById(page, frameId)
  const initialSpacing = expectDefined(before, 'before').itemSpacing

  await canvas.dragScrubInput(page.getByTestId('layout-gap-input'), 40)

  const after = await getNodeById(page, frameId)
  expect(expectDefined(after, 'after').itemSpacing).toBeGreaterThan(initialSpacing + 5)
  canvas.assertNoErrors()
})

test('gap menu sets auto space-between alignment', async () => {
  await selectFrame()

  await page.getByTestId('layout-gap-menu').click()
  await page.getByRole('option', { name: 'Auto' }).click()
  await canvas.waitForRender()
  let frame = await getNodeById(page, frameId)
  expect(expectDefined(frame, 'frame').primaryAxisAlign).toBe('SPACE_BETWEEN')
  await expect(page.getByTestId('layout-alignment-grid').locator('button')).toHaveCount(9)

  await page.getByTestId('layout-gap-menu').click()
  await page
    .getByRole('option', { name: String(Math.round(expectDefined(frame, 'frame').itemSpacing)) })
    .click()
  await canvas.waitForRender()

  frame = await getNodeById(page, frameId)
  expect(expectDefined(frame, 'frame').primaryAxisAlign).toBe('MIN')
  await expect(page.getByTestId('layout-alignment-grid').locator('button')).toHaveCount(9)
  canvas.assertNoErrors()
})

test('wrap mode exposes cross-axis gap control', async () => {
  await selectFrame()

  await page.getByTestId('layout-direction-wrap').click()
  await canvas.waitForRender()

  const before = await getNodeById(page, frameId)
  const initialSpacing = expectDefined(before, 'before').counterAxisSpacing
  await canvas.dragScrubInput(page.getByTestId('layout-cross-gap-input'), 40)

  const after = await getNodeById(page, frameId)
  expect(expectDefined(after, 'after').layoutWrap).toBe('WRAP')
  expect(expectDefined(after, 'after').counterAxisSpacing).toBeGreaterThan(initialSpacing + 5)
  canvas.assertNoErrors()
})

test('padding controls set horizontal and vertical padding pairs', async () => {
  await selectFrame()

  await page.getByTestId('layout-horizontal-padding-input').click()
  await canvas.waitForRender()
  const horizontalInput = page
    .getByTestId('layout-horizontal-padding-input')
    .getByTestId('scrub-input-field')
  await horizontalInput.fill('24')
  await horizontalInput.press('Enter')
  await canvas.waitForRender()

  await page.getByTestId('layout-vertical-padding-input').click()
  await canvas.waitForRender()
  const verticalInput = page
    .getByTestId('layout-vertical-padding-input')
    .getByTestId('scrub-input-field')
  await verticalInput.fill('16')
  await verticalInput.press('Enter')
  await canvas.waitForRender()

  const frame = await getNodeById(page, frameId)
  expect(expectDefined(frame, 'frame').paddingTop).toBe(16)
  expect(expectDefined(frame, 'frame').paddingRight).toBe(24)
  expect(expectDefined(frame, 'frame').paddingBottom).toBe(16)
  expect(expectDefined(frame, 'frame').paddingLeft).toBe(24)
  canvas.assertNoErrors()
})

test('size dropdown adds and removes min width', async () => {
  await selectFrame()

  await page.getByTestId('layout-width-sizing-menu').click()
  await page.getByText('Add min width').click()
  await canvas.waitForRender()

  let frame = await getNodeById(page, frameId)
  expect(expectDefined(frame, 'frame').minWidth).toBe(
    Math.round(expectDefined(frame, 'frame').width)
  )
  await expect(page.getByTestId('layout-min-width-input')).toBeVisible()

  await page.getByTestId('layout-width-sizing-menu').click()
  await page.getByText('Remove min width').click()
  await canvas.waitForRender()

  frame = await getNodeById(page, frameId)
  expect(expectDefined(frame, 'frame').minWidth).toBeNull()
  await expect(page.getByTestId('layout-min-width-input')).toHaveCount(0)
  canvas.assertNoErrors()
})

test('alignment grid center sets CENTER alignment', async () => {
  await selectFrame()

  const centerCell = page.getByTestId('layout-alignment-grid').locator('button').nth(4)
  await centerCell.click()
  await canvas.waitForRender()

  const frame = await getNodeById(page, frameId)
  expect(expectDefined(frame, 'frame').primaryAxisAlign).toBe('CENTER')
  expect(expectDefined(frame, 'frame').counterAxisAlign).toBe('CENTER')
  canvas.assertNoErrors()
})

test('remove auto-layout sets layoutMode to NONE', async () => {
  await selectFrame()

  await page.getByTestId('layout-remove-auto').click()
  await canvas.waitForRender()

  const frame = await getNodeById(page, frameId)
  expect(expectDefined(frame, 'frame').layoutMode).toBe('NONE')
  canvas.assertNoErrors()
})
