import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test&no-chrome')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

test.beforeEach(async () => {
  await canvas.clearCanvas()
})

async function expectCanvas(name: string) {
  canvas.assertNoErrors()
  const buffer = await canvas.canvas.screenshot()
  expect(buffer).toMatchSnapshot(`${name}.png`)
}

async function createOverlayDemo(rotation: number) {
  await page.evaluate((frameRotation) => {
    const store = window.__OPEN_PENCIL_STORE__!
    const pageId = store.state.currentPageId

    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Typography',
      x: 140,
      y: 140,
      width: 300,
      height: 120,
      rotation: frameRotation,
      cornerRadius: 16,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }],
      strokes: []
    })

    store.graph.createNode('TEXT', frame.id, {
      name: 'Heading',
      text: 'Heading',
      x: 24,
      y: 20,
      width: 120,
      height: 32,
      fontSize: 22,
      fontWeight: 700,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })

    store.graph.createNode('TEXT', frame.id, {
      name: 'Body',
      text: 'The quick brown fox jumps.',
      x: 24,
      y: 62,
      width: 220,
      height: 24,
      fontSize: 14,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })

    const hoverTarget = store.graph.createNode('RECTANGLE', frame.id, {
      name: 'Hover Target',
      x: 210,
      y: 28,
      width: 56,
      height: 40,
      cornerRadius: 10,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.42, g: 0.78, b: 0.58, a: 1 },
          visible: true,
          opacity: 1
        }
      ]
    })

    store.select([frame.id])
    store.state.hoveredNodeId = hoverTarget.id
    store.requestRender()
  }, rotation)

  await canvas.waitForRender()
}

test('rotated frame selection labels render with hovered child', async () => {
  await createOverlayDemo(18)
  await expectCanvas('rotated-frame-selection-labels')
})

test('rotation preview updates frame labels before mouse up', async () => {
  await createOverlayDemo(0)

  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const frameId = [...store.state.selectedIds][0]
    store.state.rotationPreview = { nodeId: frameId, angle: 28 }
    store.requestRepaint()
  })

  await canvas.waitForRender()
  await expectCanvas('rotated-frame-selection-labels-preview')
})

test('hover highlight stays aligned for child inside rotated frame', async () => {
  await createOverlayDemo(28)
  await expectCanvas('rotated-frame-child-hover-highlight')
})
