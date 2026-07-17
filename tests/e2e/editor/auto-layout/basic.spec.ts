import { test, expect, type Page } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'
import { propertyField, propertySection } from '#tests/helpers/properties'
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
  await expect(propertySection(page, 'Layout')).toHaveScreenshot('layout-size-controls.png')
  canvas.assertNoErrors()
})

test('direction controls switch between vertical grid and horizontal layout', async () => {
  await selectFrame()
  const layout = propertySection(page, 'Auto layout')

  await layout.getByRole('button', { name: 'Vertical layout' }).click()
  await canvas.waitForRender()
  expect(expectDefined(await getNodeById(page, frameId), 'frame').layoutMode).toBe('VERTICAL')

  await layout.getByRole('button', { name: 'Grid layout' }).click()
  await canvas.waitForRender()
  expect(expectDefined(await getNodeById(page, frameId), 'frame').layoutMode).toBe('GRID')

  await layout.getByRole('button', { name: 'Horizontal layout' }).click()
  await canvas.waitForRender()
  expect(expectDefined(await getNodeById(page, frameId), 'frame').layoutMode).toBe('HORIZONTAL')

  await layout.getByRole('button', { name: 'Vertical layout' }).click()
  await propertyField(page, 'width').getByRole('combobox', { name: 'Width' }).click()
  await page.getByRole('option', { name: 'Hug' }).click()
  await canvas.waitForRender()
  expect(expectDefined(await getNodeById(page, frameId), 'frame').layoutMode).toBe('VERTICAL')
  canvas.assertNoErrors()
})

test('gap NumberField sets itemSpacing', async () => {
  await selectFrame()
  const before = await getNodeById(page, frameId)
  const initialSpacing = expectDefined(before, 'before').itemSpacing

  await canvas.dragNumberField(page.getByTestId('layout-gap-input'), 40)

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

  await propertySection(page, 'Auto layout').getByRole('button', { name: 'Wrap layout' }).click()
  await canvas.waitForRender()

  const before = await getNodeById(page, frameId)
  const initialSpacing = expectDefined(before, 'before').counterAxisSpacing
  await canvas.dragNumberField(page.getByTestId('layout-cross-gap-input'), 40)

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
    .getByRole('spinbutton')
  await horizontalInput.fill('24')
  await horizontalInput.press('Enter')
  await canvas.waitForRender()

  await page.getByTestId('layout-vertical-padding-input').click()
  await canvas.waitForRender()
  const verticalInput = page.getByTestId('layout-vertical-padding-input').getByRole('spinbutton')
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

  const layout = propertySection(page, 'Layout')
  await propertyField(page, 'width').getByRole('combobox', { name: 'Width' }).click()
  await page.getByRole('option', { name: 'Add min width' }).click()
  await canvas.waitForRender()

  let frame = await getNodeById(page, frameId)
  expect(expectDefined(frame, 'frame').minWidth).toBe(
    Math.round(expectDefined(frame, 'frame').width)
  )
  await expect(layout.locator('[data-property="minWidth"]')).toBeVisible()

  await propertyField(page, 'width').getByRole('combobox', { name: 'Width' }).click()
  await page.getByRole('option', { name: 'Remove min width' }).click()
  await canvas.waitForRender()

  frame = await getNodeById(page, frameId)
  expect(expectDefined(frame, 'frame').minWidth).toBeNull()
  await expect(layout.locator('[data-property="minWidth"]')).toHaveCount(0)
  canvas.assertNoErrors()
})

test('editing a Hug width switches to Fixed in one reversible interaction', async () => {
  await selectFrame()
  const widthField = propertyField(page, 'width')

  await widthField.getByRole('combobox', { name: 'Width' }).click()
  await page.getByRole('option', { name: 'Hug' }).click()
  await canvas.waitForRender()

  const before = expectDefined(await getNodeById(page, frameId), 'before')
  expect(before.counterAxisSizing).toBe('HUG')

  await widthField.focus()
  await widthField.getByRole('spinbutton').press('Escape')
  const afterFocus = expectDefined(await getNodeById(page, frameId), 'after focus')
  expect(afterFocus.counterAxisSizing).toBe('HUG')

  await widthField.focus()
  const input = widthField.getByRole('spinbutton')
  await input.fill(String(Math.round(before.width + 40)))
  await input.press('Escape')
  await canvas.waitForRender()

  const cancelled = expectDefined(await getNodeById(page, frameId), 'cancelled')
  expect(cancelled.counterAxisSizing).toBe('HUG')
  expect(cancelled.width).toBeCloseTo(before.width)

  await widthField.focus()
  await widthField.getByRole('spinbutton').fill(String(Math.round(before.width + 40)))
  await widthField.getByRole('spinbutton').press('Enter')
  await canvas.waitForRender()

  const changed = expectDefined(await getNodeById(page, frameId), 'changed')
  expect(changed.counterAxisSizing).toBe('FIXED')
  expect(changed.width).toBe(Math.round(before.width + 40))

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  const undone = expectDefined(await getNodeById(page, frameId), 'undone')
  expect(undone.counterAxisSizing).toBe('HUG')
  expect(undone.width).toBeCloseTo(before.width)
  canvas.assertNoErrors()
})

test('editing a Fill height switches to Fixed in one undo step', async () => {
  await selectFrame()
  const heightField = propertyField(page, 'height')

  await heightField.getByRole('combobox', { name: 'Height' }).click()
  await page.getByRole('option', { name: 'Fill' }).click()
  await canvas.waitForRender()

  const before = expectDefined(await getNodeById(page, frameId), 'before')
  expect(before.primaryAxisSizing).toBe('FILL')

  await heightField.focus()
  await heightField.getByRole('spinbutton').fill(String(Math.round(before.height + 30)))
  await heightField.getByRole('spinbutton').press('Enter')
  await canvas.waitForRender()

  const changed = expectDefined(await getNodeById(page, frameId), 'changed')
  expect(changed.primaryAxisSizing).toBe('FIXED')
  expect(changed.height).toBe(Math.round(before.height + 30))

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  const undone = expectDefined(await getNodeById(page, frameId), 'undone')
  expect(undone.primaryAxisSizing).toBe('FILL')
  expect(undone.height).toBeCloseTo(before.height)
  canvas.assertNoErrors()
})

test('alignment grid center sets CENTER alignment', async () => {
  await selectFrame()

  const centerCell = page.getByTestId('layout-alignment-grid').locator('button').nth(4)
  await centerCell.click()
  await canvas.waitForRender()
  await expect(centerCell).toHaveAttribute('data-active', 'true')

  const frame = await getNodeById(page, frameId)
  expect(expectDefined(frame, 'frame').primaryAxisAlign).toBe('CENTER')
  expect(expectDefined(frame, 'frame').counterAxisAlign).toBe('CENTER')
  canvas.assertNoErrors()
})

test('remove auto-layout sets layoutMode to NONE', async () => {
  await selectFrame()

  await propertySection(page, 'Auto layout')
    .getByRole('button', { name: 'Remove auto layout' })
    .click()
  await canvas.waitForRender()

  const frame = await getNodeById(page, frameId)
  expect(expectDefined(frame, 'frame').layoutMode).toBe('NONE')
  canvas.assertNoErrors()
})
