import { test, expect } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

test.describe('SkPicture scene caching', () => {
  test.describe.configure({ timeout: 120_000 })
  let helper: CanvasHelper

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    helper = new CanvasHelper(page)
    await page.goto('/?test&no-chrome&no-rulers')
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
    // Wait for font loading
    await helper.page.waitForTimeout(500)
    await helper.waitForRender()
  })

  test.afterAll(async () => {
    await helper.page.close()
  })

  test('stale scene picture is invalidated after font load', async () => {
    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const renderer = store.renderer
      if (!renderer) throw new Error('OpenPencil renderer not initialized')
      renderer.invalidateScenePicture()
      store.requestRender()
    })
    await helper.waitForRender()

    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.requestRender()
    })
    await helper.waitForRender()

    const baseline = await helper.screenshotCanvas()

    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const pg = store.graph.getNode(store.state.currentPageId)
      if (!pg) throw new Error(`Page ${store.state.currentPageId} not found`)
      const frame = pg.childIds.find((id: string) => store.graph.getNode(id)?.type === 'FRAME')
      store.setHoveredNode(frame ?? null)
    })
    await helper.waitForRender()

    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.setHoveredNode(null)
    })
    await helper.waitForRender()
    const afterCycle = await helper.screenshotCanvas()

    expect(Buffer.from(baseline)).toEqual(Buffer.from(afterCycle))
  })

  test('text survives hover on/off cycle', async () => {
    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.setHoveredNode(null)
      store.requestRender()
    })
    await helper.waitForRender()
    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.requestRender()
    })
    await helper.waitForRender()
    const baseline = await helper.screenshotCanvas()

    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const page = store.graph.getNode(store.state.currentPageId)
      if (!page) throw new Error(`Page ${store.state.currentPageId} not found`)
      const frame = page.childIds.find((id: string) => store.graph.getNode(id)?.type === 'FRAME')
      store.setHoveredNode(frame ?? null)
    })
    await helper.waitForRender()

    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.setHoveredNode(null)
    })
    await helper.waitForRender()
    const afterHover = await helper.screenshotCanvas()

    expect(afterHover).toMatchSnapshot('text-after-hover-cycle.png')
    expect(Buffer.from(baseline)).toEqual(Buffer.from(afterHover))
  })

  test('text survives multiple hover cycles', async () => {
    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const page = store.graph.getNode(store.state.currentPageId)
      if (!page) throw new Error(`Page ${store.state.currentPageId} not found`)
      const frame = page.childIds.find((id: string) => store.graph.getNode(id)?.type === 'FRAME')

      for (let i = 0; i < 10; i++) {
        store.setHoveredNode(frame ?? null)
        store.setHoveredNode(null)
      }
    })
    await helper.waitForRender()
    const screenshot = await helper.screenshotCanvas()
    expect(screenshot).toMatchSnapshot('text-after-multiple-hover-cycles.png')
  })

  test('text survives real mouse hover on/off', async () => {
    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.setHoveredNode(null)
      store.requestRender()
    })
    await helper.waitForRender()
    const baseline = await helper.screenshotCanvas()

    const box = expectDefined(await helper.canvas.boundingBox(), 'canvas bounds')
    await helper.page.mouse.move(box.x + 200, box.y + 150)
    await helper.waitForRender()
    await helper.page.waitForTimeout(100)

    await helper.page.mouse.move(box.x + 800, box.y + 600)
    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.setHoveredNode(null)
    })
    await helper.waitForRender()
    await helper.page.waitForTimeout(100)

    const afterHover = await helper.screenshotCanvas()
    expect(afterHover).toMatchSnapshot('text-after-real-hover-cycle.png')
    expect(baseline.length).toBeGreaterThan(0)
  })

  test('text survives scene change then hover cycle', async () => {
    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const page = store.graph.getNode(store.state.currentPageId)
      if (!page) throw new Error(`Page ${store.state.currentPageId} not found`)
      const frame = page.childIds.find((id: string) => store.graph.getNode(id)?.type === 'FRAME')
      if (frame) store.graph.updateNode(frame, { width: 310 })
      store.requestRender()
    })
    await helper.waitForRender()

    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const page = store.graph.getNode(store.state.currentPageId)
      if (!page) throw new Error(`Page ${store.state.currentPageId} not found`)
      const frame = page.childIds.find((id: string) => store.graph.getNode(id)?.type === 'FRAME')
      store.setHoveredNode(frame ?? null)
    })
    await helper.waitForRender()

    await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.setHoveredNode(null)
    })
    await helper.waitForRender()
    const screenshot = await helper.screenshotCanvas()
    expect(screenshot).toMatchSnapshot('text-after-scene-change-hover.png')
  })
})
