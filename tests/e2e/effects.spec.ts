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

test('drop shadow on white card', async () => {
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const pageId = store.state.currentPageId
    store.graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 80,
      y: 80,
      width: 200,
      height: 120,
      cornerRadius: 12,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 16,
          spread: 0,
          visible: true
        }
      ]
    })
    store.clearSelection()
    store.requestRender()
  })
  await canvas.waitForRender()
  await expectCanvas('drop-shadow-white-card')
})

test('drop shadow with spread', async () => {
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const pageId = store.state.currentPageId
    store.graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 80,
      y: 80,
      width: 200,
      height: 120,
      cornerRadius: 12,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0.23, g: 0.51, b: 0.96, a: 0.3 },
          offset: { x: 0, y: 4 },
          radius: 12,
          spread: 8,
          visible: true
        }
      ]
    })
    store.clearSelection()
    store.requestRender()
  })
  await canvas.waitForRender()
  await expectCanvas('drop-shadow-with-spread')
})

test('inner shadow', async () => {
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const pageId = store.state.currentPageId
    store.graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 80,
      y: 80,
      width: 200,
      height: 120,
      cornerRadius: 12,
      fills: [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.97, a: 1 }, visible: true, opacity: 1 }],
      effects: [
        {
          type: 'INNER_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.15 },
          offset: { x: 0, y: 2 },
          radius: 8,
          spread: 0,
          visible: true
        }
      ]
    })
    store.clearSelection()
    store.requestRender()
  })
  await canvas.waitForRender()
  await expectCanvas('inner-shadow')
})

test('inner shadow with spread', async () => {
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const pageId = store.state.currentPageId
    store.graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 80,
      y: 80,
      width: 200,
      height: 120,
      cornerRadius: 12,
      fills: [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.97, a: 1 }, visible: true, opacity: 1 }],
      effects: [
        {
          type: 'INNER_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.2 },
          offset: { x: 0, y: 2 },
          radius: 8,
          spread: 4,
          visible: true
        }
      ]
    })
    store.clearSelection()
    store.requestRender()
  })
  await canvas.waitForRender()
  await expectCanvas('inner-shadow-with-spread')
})

test('drop shadow on ellipse', async () => {
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const pageId = store.state.currentPageId
    store.graph.createNode('ELLIPSE', pageId, {
      name: 'Circle',
      x: 100,
      y: 80,
      width: 160,
      height: 160,
      fills: [{ type: 'SOLID', color: { r: 0.38, g: 0.35, b: 0.95, a: 1 }, visible: true, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.3 },
          offset: { x: 0, y: 6 },
          radius: 20,
          spread: 0,
          visible: true
        }
      ]
    })
    store.clearSelection()
    store.requestRender()
  })
  await canvas.waitForRender()
  await expectCanvas('drop-shadow-ellipse')
})

test('combined drop and inner shadow', async () => {
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const pageId = store.state.currentPageId
    store.graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 80,
      y: 80,
      width: 200,
      height: 120,
      cornerRadius: 12,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.15 },
          offset: { x: 0, y: 4 },
          radius: 16,
          spread: 0,
          visible: true
        },
        {
          type: 'INNER_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.08 },
          offset: { x: 0, y: 1 },
          radius: 2,
          spread: 0,
          visible: true
        }
      ]
    })
    store.clearSelection()
    store.requestRender()
  })
  await canvas.waitForRender()
  await expectCanvas('combined-drop-inner-shadow')
})

test('text drop shadow on glyphs', async () => {
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const pageId = store.state.currentPageId
    store.graph.createNode('TEXT', pageId, {
      name: 'Shadow Text',
      x: 60,
      y: 120,
      width: 300,
      height: 50,
      text: 'Shadow',
      fontSize: 40,
      fontWeight: 700,
      fontFamily: 'Inter',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0.23, g: 0.51, b: 0.96, a: 0.6 },
          offset: { x: 3, y: 3 },
          radius: 6,
          spread: 0,
          visible: true
        }
      ]
    })
    store.clearSelection()
    store.requestRender()
  })
  await canvas.waitForRender()
  await page.waitForTimeout(500)
  await canvas.waitForRender()
  await expectCanvas('text-drop-shadow')
})

test('layer blur', async () => {
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const pageId = store.state.currentPageId
    store.graph.createNode('RECTANGLE', pageId, {
      name: 'Blurred',
      x: 80,
      y: 80,
      width: 200,
      height: 120,
      cornerRadius: 12,
      fills: [{ type: 'SOLID', color: { r: 0.23, g: 0.51, b: 0.96, a: 1 }, visible: true, opacity: 1 }],
      effects: [
        {
          type: 'LAYER_BLUR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 8,
          spread: 0,
          visible: true
        }
      ]
    })
    store.clearSelection()
    store.requestRender()
  })
  await canvas.waitForRender()
  await expectCanvas('layer-blur')
})

test('invisible effect has no visual impact', async () => {
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const pageId = store.state.currentPageId
    store.graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 80,
      y: 80,
      width: 200,
      height: 120,
      cornerRadius: 12,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 0, y: 8 },
          radius: 24,
          spread: 0,
          visible: false
        }
      ]
    })
    store.clearSelection()
    store.requestRender()
  })
  await canvas.waitForRender()
  await expectCanvas('invisible-effect')
})
