import { expect, test, type Page } from '@playwright/test'

import { expectDefined } from '@open-pencil/test-support/assert'

import { CanvasHelper } from '#tests/helpers/canvas'
import { layerDriver } from '#tests/helpers/canvas/layers'
import { propertyField } from '#tests/helpers/properties'
import { getNodeById, getSelectedNode } from '#tests/helpers/store'

let page: Page
let canvas: CanvasHelper
const layers = layerDriver(() => page)

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
})

test.afterAll(async () => {
  await page.close()
})

test('K scales text and its stroke from a corner handle', async () => {
  await canvas.clearCanvas()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.graph.createNode('TEXT', store.state.currentPageId, {
      x: 100,
      y: 100,
      width: 120,
      height: 40,
      text: 'Scale',
      fontSize: 20,
      strokeWeight: 2
    }).id
    store.select([id])
  })
  await canvas.waitForRender()

  await canvas.pressKey('k')
  expect(await page.evaluate(() => window.openPencil?.getStore?.().state.activeTool)).toBe('SCALE')

  const handle = await layers.selectedCorner()
  await canvas.drag(handle.x, handle.y, handle.x + 120, handle.y + 40)
  await canvas.waitForRender()

  const scaled = expectDefined(await getSelectedNode(page), 'scaled text')
  expect({ width: scaled.width, height: scaled.height }).toEqual({ width: 240, height: 80 })
  expect(scaled.fontSize).toBe(40)
  expect(scaled.strokeWeight).toBe(4)

  await canvas.pressKey('v')
  expect(await page.evaluate(() => window.openPencil?.getStore?.().state.activeTool)).toBe('SELECT')

  await page.keyboard.press('ControlOrMeta+z')
  await canvas.waitForRender()
  const restored = expectDefined(await getSelectedNode(page), 'restored text')
  expect(restored.fontSize).toBe(20)
  expect(restored.strokeWeight).toBe(2)
  canvas.assertNoErrors()
})

test('scales a card and the text and stroke inside it', async () => {
  await canvas.clearCanvas()
  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
      x: 100,
      y: 100,
      width: 200,
      height: 100
    })
    const text = store.graph.createNode('TEXT', frame.id, {
      x: 20,
      y: 20,
      width: 120,
      height: 40,
      text: 'Card',
      fontSize: 20
    })
    const rect = store.graph.createNode('RECTANGLE', frame.id, {
      x: 20,
      y: 70,
      width: 100,
      height: 20,
      strokeWeight: 2
    })
    store.select([frame.id])
    return { frame: frame.id, text: text.id, rect: rect.id }
  })
  await canvas.waitForRender()
  await canvas.pressKey('k')

  const handle = await layers.selectedCorner()
  await canvas.drag(handle.x, handle.y, handle.x + 200, handle.y + 100)
  await canvas.waitForRender()

  const frame = expectDefined(await getSelectedNode(page), 'scaled frame')
  expect({ width: frame.width, height: frame.height }).toEqual({ width: 400, height: 200 })
  const text = expectDefined(await getNodeById(page, ids.text), 'scaled text')
  const rect = expectDefined(await getNodeById(page, ids.rect), 'scaled rectangle')
  expect(text.fontSize).toBe(40)
  expect(rect.strokeWeight).toBe(4)
  canvas.assertNoErrors()
})

test('the Scale panel scales about the anchor and hands back to Move', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 100, 50)
  await canvas.click(250, 225)
  await canvas.waitForRender()
  const before = expectDefined(await getSelectedNode(page), 'rectangle')
  await canvas.pressKey('k')

  const factor = page.getByRole('spinbutton', { name: 'Scale multiplier' })
  await factor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('2')
  await page.keyboard.press('Enter')
  await canvas.waitForRender()

  // The anchor starts at the center, so the box grows around it, as in Figma.
  const scaled = expectDefined(await getSelectedNode(page), 'scaled rectangle')
  expect({ width: scaled.width, height: scaled.height }).toEqual({ width: 200, height: 100 })
  expect({ x: scaled.x, y: scaled.y }).toEqual({ x: before.x - 50, y: before.y - 25 })
  expect(await page.evaluate(() => window.openPencil?.getStore?.().state.activeTool)).toBe('SELECT')
  canvas.assertNoErrors()
})

test('scrubbing the Scale factor scales the selection and stays in the tool', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 100, 50)
  await canvas.click(250, 225)
  await canvas.waitForRender()
  const before = expectDefined(await getSelectedNode(page), 'rectangle')
  await canvas.pressKey('k')

  await canvas.dragNumberField(propertyField(page, 'scale'), 40)

  const scaled = expectDefined(await getSelectedNode(page), 'scaled rectangle')
  expect(scaled.width).toBeGreaterThan(before.width)
  expect(scaled.width / scaled.height).toBeCloseTo(before.width / before.height)
  expect(await page.evaluate(() => window.openPencil?.getStore?.().state.activeTool)).toBe('SCALE')
  canvas.assertNoErrors()
})

test('Escape abandons a Scale drag and the release changes nothing', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(200, 200, 100, 50)
  await canvas.click(250, 225)
  await canvas.waitForRender()
  const before = expectDefined(await getSelectedNode(page), 'rectangle')
  await canvas.pressKey('k')

  const handle = await layers.selectedCorner()
  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('No canvas')
  await page.mouse.move(box.x + handle.x, box.y + handle.y)
  await page.mouse.down()
  await page.mouse.move(box.x + handle.x + 100, box.y + handle.y + 50, { steps: 10 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await canvas.waitForRender()

  const after = expectDefined(await getNodeById(page, before.id), 'rectangle')
  expect({ x: after.x, y: after.y, width: after.width, height: after.height }).toEqual({
    x: before.x,
    y: before.y,
    width: before.width,
    height: before.height
  })
  canvas.assertNoErrors()
})
