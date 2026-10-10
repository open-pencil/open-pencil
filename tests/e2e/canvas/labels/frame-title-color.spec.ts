import { expect, test, type Page } from '@playwright/test'
import { fromUint8Array } from 'js-base64'

import { CanvasHelper } from '#tests/helpers/canvas'

// Figma desktop 126 draws a frame's name against what it sits on: a white section's frame names
// stay dark on a dark page, and names fade more on light backgrounds than on dark ones.

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ deviceScaleFactor: 2 })
  await page.goto('/?test&no-chrome&no-rulers')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

async function showSections(shade: number) {
  await canvas.clearCanvas()
  await page.evaluate((shade) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.setPageColor({ r: shade / 255, g: shade / 255, b: shade / 255, a: 1 })
    const pageId = store.state.currentPageId
    const solid = (v: number) => [
      { type: 'SOLID' as const, color: { r: v, g: v, b: v, a: 1 }, opacity: 1, visible: true }
    ]
    const section = (name: string, x: number, v: number) => {
      const s = store.graph.createNode('SECTION', pageId, {
        name,
        x,
        y: 0,
        width: 360,
        height: 260,
        fills: solid(v)
      })
      store.graph.createNode('FRAME', s.id, {
        name: 'Frame inside',
        x: 80,
        y: 100,
        width: 200,
        height: 120,
        fills: solid(0.9)
      })
    }
    section('White', 0, 1)
    section('Dark', 420, 0.267)
    store.graph.createNode('FRAME', pageId, {
      name: 'Loose frame',
      x: 880,
      y: 100,
      width: 200,
      height: 120,
      fills: solid(1)
    })
    store.state.zoom = 1
    store.state.panX = 40
    store.state.panY = 60
    store.clearSelection()
    store.requestRender()
  }, shade)
  await page.mouse.move(2, 2)
  await canvas.waitForRender()
}

/** The darkest and brightest red channel in a region of the canvas, read from a screenshot. */
async function regionRange(x: number, y: number, width = 70, height = 16) {
  const box = await canvas.canvas.boundingBox()
  if (!box) throw new Error('No canvas')
  const shot = await page.screenshot({ clip: { x: box.x + x, y: box.y + y, width, height } })
  return page.evaluate(async (data) => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const copy = document.createElement('canvas')
    copy.width = image.width
    copy.height = image.height
    const context = copy.getContext('2d')
    if (!context) throw new Error('No 2D context')
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, image.width, image.height).data
    let darkest = 255
    let brightest = 0
    for (let i = 0; i < pixels.length; i += 4) {
      darkest = Math.min(darkest, pixels[i])
      brightest = Math.max(brightest, pixels[i])
    }
    return { darkest, brightest }
  }, fromUint8Array(shot))
}

/** The white section's frame name sits just above the frame at (80, 100), panned to (40, 60). */
async function whiteSectionLabelDarkest() {
  return (await regionRange(118, 140)).darkest
}

async function expectReadableNames(name: 'dark' | 'light', shade: number) {
  await showSections(shade)
  // Dark text on the white section, faded as Figma fades it (its darkest pixel is about 204).
  const darkest = await whiteSectionLabelDarkest()
  expect(darkest).toBeLessThan(220)
  expect(darkest).toBeGreaterThan(180)
  expect(await canvas.screenshotCanvasRegion(1100, 260)).toMatchSnapshot(
    `frame-title-colors-${name}.png`
  )
}

test('frame names on a dark page read on white and dark sections', async () => {
  await expectReadableNames('dark', 30)
})

test('frame names on a light page read on white and dark sections', async () => {
  await expectReadableNames('light', 245)
})

// Names drawn above a section's top edge sit on the page, and a section's hidden fill does not
// count, so these stay readable too.
test('a name above a section sits on the page, and a hidden fill does not count', async () => {
  await canvas.clearCanvas()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.setPageColor({ r: 30 / 255, g: 30 / 255, b: 30 / 255, a: 1 })
    const pageId = store.state.currentPageId
    const solid = (v: number, visible = true) => ({
      type: 'SOLID' as const,
      color: { r: v, g: v, b: v, a: 1 },
      opacity: 1,
      visible
    })
    const edge = store.graph.createNode('SECTION', pageId, {
      name: 'Edge',
      x: 0,
      y: 0,
      width: 360,
      height: 260,
      fills: [solid(1)]
    })
    store.graph.createNode('FRAME', edge.id, {
      name: 'At the top edge',
      x: 80,
      y: 0,
      width: 200,
      height: 120,
      fills: [solid(0.9)]
    })
    const hidden = store.graph.createNode('SECTION', pageId, {
      name: 'Hidden first fill',
      x: 420,
      y: 0,
      width: 360,
      height: 260,
      fills: [solid(0.1, false), solid(1)]
    })
    store.graph.createNode('FRAME', hidden.id, {
      name: 'Frame inside',
      x: 80,
      y: 100,
      width: 200,
      height: 120,
      fills: [solid(0.9)]
    })
    store.state.zoom = 1
    store.state.panX = 40
    store.state.panY = 60
    store.clearSelection()
    store.requestRender()
  })
  await page.mouse.move(2, 2)
  await canvas.waitForRender()
  // Over the dark page: light text, brighter than the page.
  expect((await regionRange(118, 40)).brightest).toBeGreaterThan(90)
  // On the hidden fill's section, whose visible fill is white: dark text.
  expect((await regionRange(538, 140)).darkest).toBeLessThan(220)
})
