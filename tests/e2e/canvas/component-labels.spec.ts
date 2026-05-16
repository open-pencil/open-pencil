import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test&no-chrome&no-rulers')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

test.beforeEach(async () => {
  await canvas.clearCanvas()
})

test('component labels in component sets are hit-tested above the component bounds', async () => {
  const componentId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = graph.getPages()[0].id
    const set = graph.createNode('COMPONENT_SET', pageId, {
      name: 'Button',
      x: 100,
      y: 100,
      width: 220,
      height: 120,
      fills: [],
      strokes: []
    })
    const component = graph.createNode('COMPONENT', set.id, {
      name: 'Primary',
      x: 20,
      y: 40,
      width: 120,
      height: 40,
      cornerRadius: 8,
      fills: [
        { type: 'SOLID', color: { r: 0.25, g: 0.49, b: 0.95, a: 1 }, opacity: 1, visible: true }
      ]
    })
    store.state.zoom = 2
    store.state.panX = 80
    store.state.panY = 80
    store.clearSelection()
    store.requestRender()
    return component.id
  })
  await canvas.waitForRender()

  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('No canvas')

  const componentTopY = 80 + (100 + 40) * 2
  const componentLeftX = 80 + (100 + 20) * 2
  await page.mouse.click(box.x + componentLeftX + 24, box.y + componentTopY - 12)
  await canvas.waitForRender()

  const selected = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds]
  })
  expect(selected).toEqual([componentId])
  canvas.assertNoErrors()
})
