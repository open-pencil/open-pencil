import { test, expect } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'

test.describe('SkPicture scene caching', () => {
  let helper: CanvasHelper

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    helper = new CanvasHelper(page)
    await page.goto('http://localhost:1420/?test&no-chrome')
    await helper.waitForInit()

    await page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
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
    // Regression: loadFonts() is async. The first render can record an SkPicture
    // before fonts load (using fallback drawText). If loadFonts() doesn't
    // invalidate the cache, hover off replays the stale picture → text vanishes.
    //
    // We simulate this by calling invalidateScenePicture() to force the next
    // render to re-record, then verify hover on/off doesn't lose text.
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      // Simulate what loadFonts() does: invalidate the cached picture
      store.renderer!.invalidateScenePicture()
      store.requestRender()
    })
    await helper.waitForRender()

    // Extra render to stabilize the SkPicture cache
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      store.requestRender()
    })
    await helper.waitForRender()

    // Baseline after cache was invalidated and re-recorded
    const baseline = await helper.screenshotCanvas()

    // Hover frame → un-hover: replays the newly recorded picture
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const pg = store.graph.getNode(store.state.currentPageId)!
      const frame = pg.childIds.find((id: string) => store.graph.getNode(id)?.type === 'FRAME')
      store.setHoveredNode(frame ?? null)
    })
    await helper.waitForRender()

    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      store.setHoveredNode(null)
    })
    await helper.waitForRender()
    const afterCycle = await helper.screenshotCanvas()

    expect(Buffer.from(baseline)).toEqual(Buffer.from(afterCycle))
  })

  test('text survives hover on/off cycle', async () => {
    // 1. Baseline: no hover — this records the SkPicture cache
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      store.setHoveredNode(null)
      store.requestRender()
    })
    await helper.waitForRender()
    // Extra render cycle to ensure SkPicture cache is fully recorded
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      store.requestRender()
    })
    await helper.waitForRender()
    const baseline = await helper.screenshotCanvas()

    // 2. Hover a frame — uses requestRepaint (only renderVersion, not sceneVersion)
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const page = store.graph.getNode(store.state.currentPageId)!
      const frame = page.childIds.find((id: string) => store.graph.getNode(id)?.type === 'FRAME')
      store.setHoveredNode(frame ?? null)
    })
    await helper.waitForRender()

    // 3. Hover off — should replay cached SkPicture (the critical transition)
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      store.setHoveredNode(null)
    })
    await helper.waitForRender()
    const afterHover = await helper.screenshotCanvas()

    // Text must still be visible (baseline vs after hover cycle)
    expect(afterHover).toMatchSnapshot('text-after-hover-cycle.png')
    expect(Buffer.from(baseline)).toEqual(Buffer.from(afterHover))
  })

  test('text survives multiple hover cycles', async () => {
    // Rapid hover on/off using the real setHoveredNode path (requestRepaint)
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const page = store.graph.getNode(store.state.currentPageId)!
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
    // Use actual mouse movement instead of programmatic setHoveredNode
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      store.setHoveredNode(null)
      store.requestRender()
    })
    await helper.waitForRender()
    const baseline = await helper.screenshotCanvas()

    const box = await helper.canvas.boundingBox()
    // Move mouse over the frame (at 200, 150 — center of the 300x200 frame at 50,50)
    await helper.page.mouse.move(box!.x + 200, box!.y + 150)
    await helper.waitForRender()
    await helper.page.waitForTimeout(100)

    // Move mouse to empty area (far from any node)
    await helper.page.mouse.move(box!.x + 800, box!.y + 600)
    await helper.page.evaluate(() => window.__OPEN_PENCIL_STORE__!.setHoveredNode(null))
    await helper.waitForRender()
    await helper.page.waitForTimeout(100)

    const afterHover = await helper.screenshotCanvas()
    expect(afterHover).toMatchSnapshot('text-after-real-hover-cycle.png')
    expect(baseline.length).toBeGreaterThan(0)
  })

  test('text survives scene change then hover cycle', async () => {
    // Mutate scene to invalidate picture cache
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const page = store.graph.getNode(store.state.currentPageId)!
      const frame = page.childIds.find((id: string) => store.graph.getNode(id)?.type === 'FRAME')
      if (frame) store.graph.updateNode(frame, { width: 310 })
      store.requestRender()
    })
    await helper.waitForRender()

    // Hover on then off using real path
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const page = store.graph.getNode(store.state.currentPageId)!
      const frame = page.childIds.find((id: string) => store.graph.getNode(id)?.type === 'FRAME')
      store.setHoveredNode(frame ?? null)
    })
    await helper.waitForRender()

    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      store.setHoveredNode(null)
    })
    await helper.waitForRender()
    const screenshot = await helper.screenshotCanvas()
    expect(screenshot).toMatchSnapshot('text-after-scene-change-hover.png')
  })
})
