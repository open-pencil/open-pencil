import { test, expect } from '@playwright/test'
import { CanvasHelper } from '../helpers/canvas'

const NODE_COUNT = 200

test.describe('Zoom and pan', () => {
  let helper: CanvasHelper

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    helper = new CanvasHelper(page)
    await page.goto('http://localhost:1420/?test&no-chrome')
    await helper.waitForInit()

    await page.evaluate((count: number) => {
      const store = window.__OPEN_PENCIL_STORE__!
      const cols = Math.ceil(Math.sqrt(count))
      for (let i = 0; i < count; i++) {
        store.graph.createNode('RECTANGLE', store.state.currentPageId, {
          x: (i % cols) * 60,
          y: Math.floor(i / cols) * 60,
          width: 50,
          height: 50,
          fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.8, a: 1 }, visible: true, opacity: 1 }]
        })
      }
      store.requestRender()
    }, NODE_COUNT)
    await helper.waitForRender()
  })

  test.afterAll(async () => {
    await helper.page.close()
  })

  test('wheel zoom updates viewport correctly', async () => {
    const before = await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      return { panX: store.state.panX, panY: store.state.panY, zoom: store.state.zoom }
    })

    // Playwright's mouse.wheel doesn't set ctrlKey, dispatch manually
    await helper.page.evaluate(() => {
      const canvas = document.querySelector('canvas')!
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -100,
          ctrlKey: true,
          clientX: 400,
          clientY: 300,
          bubbles: true,
          cancelable: true
        })
      )
    })
    await helper.waitForRender()
    await helper.page.waitForTimeout(50)

    const after = await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      return { panX: store.state.panX, panY: store.state.panY, zoom: store.state.zoom }
    })

    expect(after.zoom).not.toBe(before.zoom)
    helper.assertNoErrors()
  })

  test('wheel pan updates viewport correctly', async () => {
    const before = await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      return { panX: store.state.panX, panY: store.state.panY }
    })

    const box = await helper.canvas.boundingBox()
    await helper.page.mouse.move(box!.x + 400, box!.y + 300)

    // Playwright wheel without ctrl → pan
    await helper.page.evaluate(() => {
      const canvas = document.querySelector('canvas')!
      canvas.dispatchEvent(
        new WheelEvent('wheel', { deltaX: 100, deltaY: 50, bubbles: true, cancelable: true })
      )
    })
    await helper.waitForRender()
    await helper.page.waitForTimeout(50)

    const after = await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      return { panX: store.state.panX, panY: store.state.panY }
    })

    expect(after.panX).toBeLessThan(before.panX)
    expect(after.panY).toBeLessThan(before.panY)
    helper.assertNoErrors()
  })

  test('rapid wheel events are coalesced without errors', async () => {
    await helper.page.evaluate(() => {
      const canvas = document.querySelector('canvas')!
      for (let i = 0; i < 50; i++) {
        canvas.dispatchEvent(
          new WheelEvent('wheel', {
            deltaX: 0,
            deltaY: -5,
            ctrlKey: true,
            clientX: 400,
            clientY: 300,
            bubbles: true,
            cancelable: true
          })
        )
      }
    })
    await helper.waitForRender()
    await helper.page.waitForTimeout(50)

    const state = await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      return { zoom: store.state.zoom }
    })

    expect(state.zoom).toBeGreaterThan(0)
    expect(state.zoom).toBeLessThan(256)
    helper.assertNoErrors()
  })

  test('shallowReactive: selection replace triggers UI update', async () => {
    const result = await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const pageNode = store.graph.getNode(store.state.currentPageId)!
      const firstId = pageNode.childIds[0]

      store.select([firstId])
      const after = store.state.selectedIds.has(firstId)
      const size = store.state.selectedIds.size

      store.clearSelection()
      const cleared = store.state.selectedIds.size

      return { after, size, cleared }
    })

    expect(result.after).toBe(true)
    expect(result.size).toBe(1)
    expect(result.cleared).toBe(0)
  })

  test('useRafFn loop picks up renderVersion changes', async () => {
    // Ensure clean state, wait for any pending renders
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      store.state.panX = 0
      store.state.panY = 0
      store.state.zoom = 1
      store.clearSelection()
      store.requestRender()
    })
    await helper.waitForRender()
    await helper.page.waitForTimeout(100)
    const before = await helper.screenshotCanvas()

    // Change fill color — always visible
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const pageNode = store.graph.getNode(store.state.currentPageId)!
      const firstId = pageNode.childIds[0]
      store.graph.updateNode(firstId, {
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
      })
      store.requestRender()
    })
    await helper.waitForRender()
    await helper.page.waitForTimeout(100)

    const after = await helper.screenshotCanvas()
    expect(Buffer.from(before)).not.toEqual(Buffer.from(after))

    // Restore
    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const pageNode = store.graph.getNode(store.state.currentPageId)!
      const firstId = pageNode.childIds[0]
      store.graph.updateNode(firstId, {
        fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.8, a: 1 }, visible: true, opacity: 1 }]
      })
      store.requestRender()
    })
    await helper.waitForRender()
  })

  test('useRafFn loop picks up selection changes', async () => {
    const before = await helper.screenshotCanvas()

    await helper.page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      const pageNode = store.graph.getNode(store.state.currentPageId)!
      store.select([pageNode.childIds[0]])
    })
    await helper.waitForRender()
    await helper.page.waitForTimeout(50)

    const after = await helper.screenshotCanvas()
    // Selection border should change the rendering
    expect(Buffer.from(before)).not.toEqual(Buffer.from(after))

    await helper.page.evaluate(() => {
      window.__OPEN_PENCIL_STORE__!.clearSelection()
    })
    await helper.waitForRender()
  })

  test('benchmark: zoom/pan pipeline throughput', async () => {
    const ITERATIONS = 500

    const results = await helper.page.evaluate((iterations: number) => {
      const store = window.__OPEN_PENCIL_STORE__!

      // Reset viewport
      store.state.panX = 0
      store.state.panY = 0
      store.state.zoom = 1
      store.requestRepaint()

      // Benchmark: applyZoom calls (store → state mutation → renderVersion bump)
      const zoomStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        store.applyZoom(i % 2 === 0 ? -1 : 1, 400, 300)
      }
      const zoomMs = performance.now() - zoomStart

      // Reset
      store.state.zoom = 1
      store.state.panX = 0
      store.state.panY = 0

      // Benchmark: pan calls
      const panStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        store.pan(1, 1)
      }
      const panMs = performance.now() - panStart

      // Benchmark: simulated wheel coalescing — many wheel events in one frame
      store.state.zoom = 1
      store.state.panX = 0
      store.state.panY = 0

      const canvas = document.querySelector('canvas')!
      const wheelStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        canvas.dispatchEvent(
          new WheelEvent('wheel', {
            deltaX: 0,
            deltaY: -2,
            ctrlKey: true,
            clientX: 400,
            clientY: 300,
            bubbles: true,
            cancelable: true
          })
        )
      }
      const wheelMs = performance.now() - wheelStart

      return {
        zoom: { ms: Math.round(zoomMs * 100) / 100, avg: Math.round((zoomMs / iterations) * 1000) / 1000 },
        pan: { ms: Math.round(panMs * 100) / 100, avg: Math.round((panMs / iterations) * 1000) / 1000 },
        wheel: { ms: Math.round(wheelMs * 100) / 100, avg: Math.round((wheelMs / iterations) * 1000) / 1000 }
      }
    }, ITERATIONS)

    console.log(`\n═══ ZOOM/PAN PIPELINE BENCHMARK (${ITERATIONS} iterations) ═══`)
    console.log(`  applyZoom:     ${results.zoom.avg}ms/call  (${results.zoom.ms}ms total)`)
    console.log(`  pan:           ${results.pan.avg}ms/call  (${results.pan.ms}ms total)`)
    console.log(`  wheel events:  ${results.wheel.avg}ms/event  (${results.wheel.ms}ms total)`)
    console.log(`═══════════════════════════════════════════════════════\n`)

    // Each call should be sub-millisecond
    expect(results.zoom.avg).toBeLessThan(1)
    expect(results.pan.avg).toBeLessThan(1)
    expect(results.wheel.avg).toBeLessThan(1)

    helper.assertNoErrors()
  })
})
