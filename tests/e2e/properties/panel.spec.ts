import { expect, test, type Page } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'
import { getPageChildren, getSelectedNode } from '#tests/helpers/store'

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

test('ScrubInput drag changes X position', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 80, 80)
  const before = await getSelectedNode(page)
  const initialX = expectDefined(before, 'selected rectangle before drag').x

  const xScrub = page
    .locator('[data-test-id="position-section"] [data-test-id="scrub-input"]')
    .first()
  await canvas.dragScrubInput(xScrub, 50)

  const after = await getSelectedNode(page)
  expect(after?.x).not.toBe(initialX)
  canvas.assertNoErrors()
})

test('corner radius uniform sets cornerRadius', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 80, 80)

  const scrubContainer = page.getByTestId('corner-radius-input')
  await scrubContainer.click()
  await canvas.waitForRender()
  const input = page.locator(
    '[data-test-id="corner-radius-input"] [data-test-id="scrub-input-field"]'
  )
  await input.fill('12')
  await input.press('Enter')
  await canvas.waitForRender()

  const node = await getSelectedNode(page)
  expect(node?.cornerRadius).toBe(12)
  canvas.assertNoErrors()
})

test('independent corners toggle shows four corner inputs', async () => {
  await page.getByTestId('independent-corners-toggle').click()
  await canvas.waitForRender()

  await expect(page.getByTestId('corner-tl-input')).toBeVisible()
  await expect(page.getByTestId('corner-tr-input')).toBeVisible()
  await expect(page.getByTestId('corner-br-input')).toBeVisible()
  await expect(page.getByTestId('corner-bl-input')).toBeVisible()
  canvas.assertNoErrors()
})

test('fill gradient switch changes fill type', async () => {
  await canvas.clearCanvas()
  await canvas.pressKey('Escape')
  await canvas.waitForRender()
  // fresh rect with default solid fill
  await canvas.drawRect(300, 300, 80, 80)
  await canvas.waitForRender()

  await expect(page.getByTestId('fill-section')).toBeVisible({ timeout: 5000 })

  const fillItem = page.getByTestId('fill-item').first()
  await expect(fillItem).toBeVisible({ timeout: 5000 })
  const fillSwatch = fillItem.getByTestId('fill-picker-swatch')
  await expect(fillSwatch).toBeVisible({ timeout: 5000 })
  await fillSwatch.click()
  await canvas.waitForRender()

  await page.getByTestId('fill-picker-tab-gradient').click()
  await canvas.waitForRender()

  const node = expectDefined(await getSelectedNode(page), 'gradient-filled node')
  expect(node.fills[0]?.type).toBe('GRADIENT_LINEAR')
  canvas.assertNoErrors()
})

test('variable bind badge appears on fill', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 80, 80)

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const col = store.graph.createCollection('Colors')
    const v = store.graph.createVariable('brand-red', 'COLOR', col.id, { r: 1, g: 0, b: 0, a: 1 })
    const id = [...store.state.selectedIds][0]
    if (!id) return
    store.graph.bindVariable(id, 'fills/0/color', v.id)
    store.state.sceneVersion++
  })
  await canvas.waitForRender()

  await expect(page.getByTestId('fill-unbind-variable')).toBeVisible()
  canvas.assertNoErrors()
})

test('fill color can bind an existing variable', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 80, 80)

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const col = store.graph.createCollection('Colors')
    const variable = store.graph.createVariable('test-brand-red', 'COLOR', col.id, {
      r: 1,
      g: 0,
      b: 0,
      a: 1
    })
    store.state.sceneVersion++
    return variable.id
  })
  await canvas.waitForRender()

  await page.getByTestId('fill-apply-variable-0').click()
  await page.getByText('test-brand-red', { exact: true }).click()
  await canvas.waitForRender()

  await expect(page.getByTestId('fill-unbind-variable')).toBeVisible()
  const fillSwatch = page.getByTestId('fill-picker-swatch')
  await expect(fillSwatch).toHaveCSS('background-color', 'rgb(255, 0, 0)')
  await fillSwatch.click()
  const colorInputs = page.locator('[role="dialog"] input[type="number"]:not(.hidden)')
  await expect(colorInputs.first()).toHaveValue('255')
  await colorInputs.first().fill('0')
  await colorInputs.first().press('Enter')
  await canvas.waitForRender()
  await expect(page.getByTestId('fill-unbind-variable')).toBeHidden()
  const boundVariableId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    return id ? (store.getNode(id)?.boundVariables['fills/0/color'] ?? null) : null
  })
  expect(boundVariableId).toBeNull()
  canvas.assertNoErrors()
})

test('fill color can create and bind a variable', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 80, 80)

  await page.getByTestId('fill-apply-variable-0').click()
  await expect(page.getByText(/Create color variable from #?[0-9A-F]{6}/)).toBeVisible()
  await page.getByTestId('fill-apply-variable-0-create').click()
  await page.getByPlaceholder('Variable name').fill('Surface/default')
  await page.getByTestId('fill-apply-variable-0-create').click()
  await canvas.waitForRender()

  await expect(page.getByTestId('fill-unbind-variable')).toBeVisible()
  const boundVariable = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const node = store.getNode(id)
    const variableId = node?.boundVariables['fills/0/color']
    return variableId ? store.getVariable(variableId)?.name : null
  })
  expect(boundVariable).toBe('Surface/default')
  canvas.assertNoErrors()
})

test('width can create, bind, and detach a number variable', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 80, 80)
  await page.getByTestId('layout-height-input').click()

  await page.getByTestId('layout-width-apply-variable').click()
  await expect(page.getByText('Create number variable from 80')).toBeVisible()
  await page.getByTestId('layout-width-apply-variable-create').click()
  await page.getByPlaceholder('Variable name').fill('Card/width')
  await page.getByTestId('layout-width-apply-variable-create').click()
  await canvas.waitForRender()

  await expect(page.getByTestId('layout-width-unbind-variable')).toBeVisible()
  const boundVariable = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const node = store.getNode(id)
    const variableId = node?.boundVariables.width
    return variableId ? store.getVariable(variableId)?.name : null
  })
  expect(boundVariable).toBe('Card/width')

  const widthField = page.getByTestId('layout-width-input')
  await widthField.click()
  const widthInput = widthField.getByTestId('scrub-input-field')
  await widthInput.fill('120')
  await widthInput.press('Enter')
  await canvas.waitForRender()

  await expect(page.getByTestId('layout-width-unbind-variable')).toBeHidden()
  const directWidth = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    const node = id ? store.getNode(id) : null
    return node ? { width: node.width, binding: node.boundVariables.width ?? null } : null
  })
  expect(directWidth).toEqual({ width: 120, binding: null })
  canvas.assertNoErrors()
})

test('alignment buttons align nodes to same X', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(50, 200, 60, 60)
  await canvas.drawRect(250, 200, 60, 60)
  await canvas.pressKey('Meta+a')
  await canvas.waitForRender()

  await page.getByTestId('position-align-left').click()
  await canvas.waitForRender()

  const children = await getPageChildren(page)
  expect(children.length).toBe(2)
  expect(children[0].x).toBe(children[1].x)
  canvas.assertNoErrors()
})

test('flip horizontal sets flipX', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 80, 80)

  await page.getByTestId('position-flip-horizontal').click()
  await canvas.waitForRender()

  const node = await getSelectedNode(page)
  expect(node?.flipX).toBe(true)
  canvas.assertNoErrors()
})

test('clip content checkbox toggles clipsContent', async () => {
  await canvas.clearCanvas()
  await canvas.pressKey('f')
  await canvas.drag(100, 100, 300, 300)
  await canvas.waitForRender()

  // Enable auto-layout so the clip-content checkbox is visible
  await canvas.pressKey('Shift+a')
  await canvas.waitForRender()

  const before = expectDefined(await getSelectedNode(page), 'selected frame before clipping')
  const initialValue = before.clipsContent

  await page.getByTestId('clip-content-checkbox').click()
  await canvas.waitForRender()

  const after = await getSelectedNode(page)
  expect(after?.clipsContent).toBe(!initialValue)
  canvas.assertNoErrors()
})
