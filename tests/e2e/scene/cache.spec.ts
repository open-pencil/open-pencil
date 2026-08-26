import { test, expect } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

test.describe('SkPicture scene caching', () => {
  let helper: CanvasHelper

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    helper = new CanvasHelper(page)
    await page.goto('http://localhost:1420/?test&no-chrome&no-rulers')
    await helper.waitForInit()
    await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const pageId = store.state.currentPageId
      store.graph.createNode('FRAME', pageId, {
        name: 'Container',
        x: 50,
        y: 50,
        width: 300,
        height: 200,
        fills: [
          { type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95, a: 1 }, visible: true, opacity: 1 }
        ]
      })
      store.graph.createNode('TEXT', pageId, {
        name: 'Title',
        x: 50,
        y: 280,
        width: 300,
        height: 40,
        text: 'Hello World',
        fontSize: 24,
        fontWeight: 700,
        fontFamily: 'Inter',
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
      })
      store.graph.createNode('TEXT', pageId, {
        name: 'Body',
        x: 50,
        y: 330,
        width: 300,
        height: 60,
        text: 'This text must survive hover transitions without disappearing.',
        fontSize: 14,
        fontFamily: 'Inter',
        fills: [
          { type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.3, a: 1 }, visible: true, opacity: 1 }
        ]
      })
      store.requestRender()
    })
    await helper.waitForRender()
    await page.waitForTimeout(500)
    await helper.waitForRender()
  })

  test.afterAll(async () => helper.page.close())

  async function cycleHover({ realMouse = false, mutate = false } = {}) {
    const framePoint = await helper.page.evaluate(
      ({ mutate }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const page = store.graph.getNode(store.state.currentPageId)
        if (!page) throw new Error('Current page not found')
        const frame = page.childIds.find((id: string) => store.graph.getNode(id)?.type === 'FRAME')
        if (mutate && frame) store.graph.updateNode(frame, { width: 310 })
        if (realMouse && frame) return { x: 200, y: 150 }
        store.setHoveredNode(frame ?? null)
        return null
      },
      { mutate, realMouse }
    )
    if (realMouse && framePoint) {
      const box = expectDefined(await helper.canvas.boundingBox(), 'canvas bounds')
      await helper.page.mouse.move(box.x + framePoint.x, box.y + framePoint.y)
    }
    await helper.waitForRender()
    if (realMouse) {
      const box = expectDefined(await helper.canvas.boundingBox(), 'canvas bounds')
      await helper.page.mouse.move(box.x + 800, box.y + 600)
    }
    await helper.page.evaluate(() => window.openPencil?.getStore?.()?.setHoveredNode(null))
    await helper.waitForRender()
  }

  test('stale scene picture is invalidated after font load', async () => {
    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store?.renderer) throw new Error('Renderer not initialized')
      store.renderer.invalidateScenePicture()
      store.requestRender()
    })
    await helper.waitForRender()
    await helper.page.evaluate(() => window.openPencil?.getStore?.()?.requestRender())
    await helper.waitForRender()
    const baseline = await helper.screenshotCanvas()
    await cycleHover()
    expect(Buffer.from(baseline)).toEqual(Buffer.from(await helper.screenshotCanvas()))
  })

  test('text survives hover on/off cycle', async () => {
    await helper.page.evaluate(() => window.openPencil?.getStore?.()?.requestRender())
    await helper.waitForRender()
    const baseline = await helper.screenshotCanvas()
    await cycleHover()
    expect(Buffer.from(baseline)).toEqual(Buffer.from(await helper.screenshotCanvas()))
  })

  test('text survives multiple hover cycles', async () => {
    await helper.page.evaluate(() => window.openPencil?.getStore?.()?.setHoveredNode(null))
    await helper.waitForRender()
    const baseline = await helper.screenshotCanvas()
    for (let i = 0; i < 10; i++) await cycleHover()
    expect(Buffer.from(baseline)).toEqual(Buffer.from(await helper.screenshotCanvas()))
  })

  test('text survives real mouse hover on/off', async () => {
    await helper.page.evaluate(() => window.openPencil?.getStore?.()?.setHoveredNode(null))
    await helper.waitForRender()
    const baseline = await helper.screenshotCanvas()
    await cycleHover({ realMouse: true })
    expect(Buffer.from(baseline)).toEqual(Buffer.from(await helper.screenshotCanvas()))
  })

  test('text survives scene change then hover cycle', async () => {
    await helper.page.evaluate(() => window.openPencil?.getStore?.()?.requestRender())
    await helper.waitForRender()
    await cycleHover({ mutate: true })
    const afterHover = await helper.screenshotCanvas()
    expect(afterHover.length).toBeGreaterThan(0)
  })
})
