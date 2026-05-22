import { test, expect, type BrowserContext } from '@playwright/test'

import { CanvasHelper, cleanupCanvasTestPage } from '#tests/helpers/canvas'

const NODE_COUNT = 5000
const WARMUP_FRAMES = 5
const MEASURE_FRAMES = 50

/**
 * ZOOM-PERF: Benchmark render performance at different zoom levels.
 *
 * When zoomed far out, viewport culling becomes useless because all
 * nodes fit in the viewport. This benchmark quantifies the degradation:
 *
 * - 100% zoom: Normal working zoom. Only a portion of nodes are visible.
 * - 25% zoom:  Medium zoom-out. More nodes visible.
 * - 10% zoom:  Wide zoom-out. Most nodes visible.
 * - 1% zoom:   Extreme zoom-out. Every node visible.
 *
 * Each test reports:
 * - avg frame time (ms)
 * - _nodeCount (nodes traversed)
 * - _culledCount (nodes culled by viewport)
 *
 * Expected: frame time grows roughly linearly with visible node count.
 * At 1% zoom, culling should be near-zero and frame time should be
 * proportional to total node count.
 */

test.describe('Zoom level render performance', () => {
  test.describe.configure({ timeout: 120_000 })

  let helper: CanvasHelper
  let context: BrowserContext

  test.beforeAll(async ({ browser }) => {
    // Use a dedicated browser context so we can close it (and release all WebGL
    // resources) when done — prevents WebGL context exhaustion for later tests.
    context = await browser.newContext()
    const page = await context.newPage()
    helper = new CanvasHelper(page)
    await page.goto('/?test&no-chrome')
    await helper.waitForInit()

    // Create a grid of nodes to simulate a large document
    await page.evaluate((count: number) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('openPencil store not available')
      const cols = Math.ceil(Math.sqrt(count))
      for (let i = 0; i < count; i++) {
        const x = (i % cols) * 100
        const y = Math.floor(i / cols) * 100
        // Mix of shapes to stress different render paths
        const shapeTypes = ['ELLIPSE', 'RECTANGLE', 'ROUNDED_RECTANGLE'] as const
        const type = shapeTypes[i % 3]
        store.graph.createNode(type, store.state.currentPageId, {
          x,
          y,
          width: 80,
          height: 80,
          cornerRadius: type === 'ROUNDED_RECTANGLE' ? 8 : 0,
          fills: [
            {
              type: 'SOLID',
              color: {
                r: 0.2 + (i % 5) * 0.15,
                g: 0.3 + (i % 7) * 0.1,
                b: 0.5 + (i % 3) * 0.15,
                a: 1
              },
              visible: true,
              opacity: 1
            }
          ],
          strokes: [
            {
              type: 'SOLID',
              color: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
              visible: true,
              opacity: 0.5,
              weight: 1
            }
          ]
        })
      }
      store.requestRender()
    }, NODE_COUNT)

    await helper.waitForRender()
    // Extra render to ensure scene picture is cached
    await helper.waitForRender()
    await helper.waitForRender()
  })

  test.afterAll(async () => {
    test.setTimeout(120_000)
    await cleanupCanvasTestPage(helper)
    // Close the entire context (not just the page) to release all WebGL
    // resources and prevent context exhaustion in later specs.
    if (context) {
      await context.close()
    }
  })

  /**
   * Run a render benchmark at a specific zoom level and viewport center.
   * Returns average frame time, node count, and cull count.
   */
  async function benchmarkZoom(
    zoom: number,
    centerX: number,
    centerY: number,
    _description: string
  ): Promise<{
    avgMs: number
    nodeCount: number
    culledCount: number
    allFrames: number[]
  }> {
    const results = await helper.page.evaluate(
      ({ zoom, centerX, centerY, warmup, measure, width, height }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer
        const graph = store.graph

        // Pan to center on the specified coordinates at the specified zoom
        renderer.dpr = window.devicePixelRatio || 1
        renderer.viewportWidth = width
        renderer.viewportHeight = height
        renderer.zoom = zoom
        renderer.panX = width / 2 - centerX * zoom
        renderer.panY = height / 2 - centerY * zoom
        renderer.showRulers = false
        renderer.pageColor = store.state.pageColor
        renderer.pageId = store.state.currentPageId

        // Force scene change to invalidate picture cache and trigger direct render
        // (5000 nodes > 500 threshold, so we're always in direct render mode)
        const v = store.state.sceneVersion + 1
        store.state.sceneVersion = v

        // Warmup frames (not measured)
        for (let i = 0; i < warmup; i++) {
          renderer.render(graph, store.state.selectedIds, {}, v)
        }

        // Measurement frames
        const times: number[] = []
        let nodeCount = 0
        let culledCount = 0

        for (let i = 0; i < measure; i++) {
          const start = performance.now()
          renderer.render(graph, store.state.selectedIds, {}, v)
          const elapsed = performance.now() - start
          times.push(elapsed)
          // Capture the last frame's counts
          nodeCount = renderer._nodeCount
          culledCount = renderer._culledCount
        }

        // Calculate average (skip first frame as it may include cold-cache effects)
        const relevant = times.slice(1)
        const avg = relevant.reduce((a, b) => a + b, 0) / relevant.length
        const max = Math.max(...relevant)
        const min = Math.min(...relevant)

        return {
          avgMs: Math.round(avg * 100) / 100,
          maxMs: Math.round(max * 100) / 100,
          minMs: Math.round(min * 100) / 100,
          nodeCount,
          culledCount,
          visibleNodes: nodeCount - culledCount,
          allFrames: relevant.map((t) => Math.round(t * 100) / 100)
        }
      },
      {
        zoom,
        centerX,
        centerY,
        warmup: WARMUP_FRAMES,
        measure: MEASURE_FRAMES,
        width: 1920,
        height: 1080
      }
    )

    return {
      avgMs: results.avgMs,
      nodeCount: results.nodeCount,
      culledCount: results.culledCount,
      allFrames: results.allFrames
    }
  }

  // The grid is sqrt(5000) ≈ 71 columns, so the document spans ~7100x7100 px
  const DOC_CENTER_X = 3550
  const DOC_CENTER_Y = 3550

  test('zoom=1.0 (normal working zoom, partial viewport)', async () => {
    const result = await benchmarkZoom(1, DOC_CENTER_X, DOC_CENTER_Y, 'Normal zoom (100%)')
    expect(result.avgMs).toBeLessThan(100)
  })

  test('zoom=0.25 (medium zoom-out)', async () => {
    const result = await benchmarkZoom(0.25, DOC_CENTER_X, DOC_CENTER_Y, 'Medium zoom-out (25%)')
    expect(result.avgMs).toBeLessThan(200)
  })

  test('zoom=0.10 (wide zoom-out, most nodes visible)', async () => {
    const result = await benchmarkZoom(0.1, DOC_CENTER_X, DOC_CENTER_Y, 'Wide zoom-out (10%)')
    // At 10% zoom, culling should be very low but still some
    // Frame time should be acceptable (< 500ms)
    expect(result.avgMs).toBeLessThan(500)
  })

  test('zoom=0.01 (extreme zoom-out, all nodes visible, culling useless)', async () => {
    const result = await benchmarkZoom(0.01, DOC_CENTER_X, DOC_CENTER_Y, 'Extreme zoom-out (1%)')
    // At 1% zoom, culling should be zero (everything in viewport)
    expect(result.culledCount).toBe(0)
    // Frame time will be high but we document it
  })

  test('zoom=0.01 panning (simulate zoomed-out navigation)', async () => {
    await helper.page.evaluate(
      ({ startPanX, startPanY, zoom, frames, width, height }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer
        const graph = store.graph

        renderer.dpr = window.devicePixelRatio || 1
        renderer.viewportWidth = width
        renderer.viewportHeight = height
        renderer.zoom = zoom
        renderer.showRulers = false
        renderer.pageColor = store.state.pageColor
        renderer.pageId = store.state.currentPageId

        const v = store.state.sceneVersion + 1
        store.state.sceneVersion = v

        // Warm up
        for (let i = 0; i < 5; i++) {
          renderer.panX = startPanX
          renderer.panY = startPanY
          renderer.render(graph, store.state.selectedIds, {}, v)
        }

        const times: number[] = []
        const nodeCounts: number[] = []
        const cullCounts: number[] = []

        for (let i = 0; i < frames; i++) {
          // Simulate panning by shifting viewport
          renderer.panX = startPanX + i * 10
          renderer.panY = startPanY + i * 5

          const start = performance.now()
          renderer.render(graph, store.state.selectedIds, {}, v)
          const elapsed = performance.now() - start

          times.push(Math.round(elapsed * 100) / 100)
          nodeCounts.push(renderer._nodeCount)
          cullCounts.push(renderer._culledCount)
        }

        const avg = times.reduce((a, b) => a + b, 0) / times.length
        const maxFrame = Math.max(...times)
        const minFrame = Math.min(...times)

        return {
          avgMs: Math.round(avg * 100) / 100,
          maxMs: Math.round(maxFrame * 100) / 100,
          minMs: Math.round(minFrame * 100) / 100,
          frames: times,
          nodeCounts: nodeCounts.slice(0, 5),
          cullCounts: cullCounts.slice(0, 5)
        }
      },
      {
        startPanX: 1920 / 2 - 3550 * 0.01,
        startPanY: 1080 / 2 - 3550 * 0.01,
        zoom: 0.01,
        frames: 60,
        width: 1920,
        height: 1080
      }
    )
  })

  /**
   * Run an LOD benchmark at a specific zoom and minScreenSize threshold.
   * Returns average frame time, node/viewport cull counts, and LOD cull count.
   */
  async function benchmarkLOD(
    zoom: number,
    minScreenSize: number,
    warmup = WARMUP_FRAMES,
    measure = MEASURE_FRAMES
  ): Promise<{ avgMs: number; nodeCount: number; culledCount: number; lodCulledCount: number }> {
    return helper.page.evaluate(
      ({ zoom, minScreenSize, centerX, centerY, width, height, warmup, measure }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer
        const graph = store.graph

        renderer.dpr = window.devicePixelRatio || 1
        renderer.viewportWidth = width
        renderer.viewportHeight = height
        renderer.zoom = zoom
        renderer.panX = width / 2 - centerX * zoom
        renderer.panY = height / 2 - centerY * zoom
        renderer.showRulers = false
        renderer.pageColor = store.state.pageColor
        renderer.pageId = store.state.currentPageId
        renderer.minScreenSize = minScreenSize

        const v = store.state.sceneVersion + 1
        store.state.sceneVersion = v

        for (let i = 0; i < warmup; i++) {
          renderer.render(graph, store.state.selectedIds, {}, v)
        }

        const times: number[] = []
        let lodCulled = 0
        for (let i = 0; i < measure; i++) {
          const start = performance.now()
          renderer.render(graph, store.state.selectedIds, {}, v)
          times.push(performance.now() - start)
          lodCulled = renderer._lodCulledCount
        }

        const relevant = times.slice(1)
        return {
          avgMs: Math.round((relevant.reduce((a, b) => a + b, 0) / relevant.length) * 100) / 100,
          nodeCount: renderer._nodeCount,
          culledCount: renderer._culledCount,
          lodCulledCount: lodCulled
        }
      },
      {
        zoom,
        minScreenSize,
        centerX: DOC_CENTER_X,
        centerY: DOC_CENTER_Y,
        width: 1920,
        height: 1080,
        warmup,
        measure
      }
    )
  }

  test('LOD: threshold disabled (minScreenSize=0) produces baseline frame times', async () => {
    const result = await benchmarkLOD(0.1, 0)

    // Backward-compat: disabled LOD matches baseline (~23ms at 10% zoom)
    expect(result.avgMs).toBeGreaterThan(15)
    expect(result.avgMs).toBeLessThan(35)
    expect(result.lodCulledCount).toBe(0)
  })

  test('LOD: threshold enabled (minScreenSize=100) reduces frame time at 10% zoom', async () => {
    // 80×80 nodes at 10% zoom = 64px² screen area. minScreenSize=100 will cull them.
    const result = await benchmarkLOD(0.1, 100)

    // LOD enabled should dramatically improve performance at 10% zoom
    // 80×80 nodes at 10% zoom = 64px² < 100px² threshold → ALL leaf nodes LOD-culled
    expect(result.avgMs).toBeLessThan(10)
    expect(result.lodCulledCount).toBeGreaterThan(0)
    // All 5000 test nodes are leaf shapes (no children/effects, not SECTION/COMPONENT_SET)
    // 80×80 at 10% zoom = 64px² < 100px² threshold → all LOD-culled
    expect(result.lodCulledCount).toBe(5000)
    expect(result.nodeCount).toBe(5000)
  })

  test('LOD: normal zoom (100%) NOT affected by LOD threshold (minScreenSize=4)', async () => {
    const result = await benchmarkLOD(1.0, 4)

    // At normal zoom (100%), 80×80 nodes = 6400px² >> 4px² threshold
    // LOD should NOT cull any visible nodes
    expect(result.lodCulledCount).toBe(0)
    expect(result.avgMs).toBeLessThan(5)
  })

  test('LOD: regression — _lodCulledCount does not accumulate across frames', async () => {
    // Verifies the pipeline reset bug is fixed: two consecutive renders
    // must produce the same _lodCulledCount, not 2× accumulation.
    const result = await helper.page.evaluate(
      ({ zoom, centerX, centerY, width, height }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer
        const graph = store.graph

        renderer.dpr = window.devicePixelRatio || 1
        renderer.viewportWidth = width
        renderer.viewportHeight = height
        renderer.zoom = zoom
        renderer.panX = width / 2 - centerX * zoom
        renderer.panY = height / 2 - centerY * zoom
        renderer.showRulers = false
        renderer.pageColor = store.state.pageColor
        renderer.pageId = store.state.currentPageId
        renderer.minScreenSize = 100 // aggressive LOD to produce non-zero count

        const v = store.state.sceneVersion + 1
        store.state.sceneVersion = v

        // Render twice — counts must be identical, not accumulated
        renderer.render(graph, store.state.selectedIds, {}, v)
        const firstCount = renderer._lodCulledCount

        renderer.render(graph, store.state.selectedIds, {}, v)
        const secondCount = renderer._lodCulledCount

        return { firstCount, secondCount }
      },
      { zoom: 0.1, centerX: 3550, centerY: 3550, width: 1920, height: 1080 }
    )

    // Fix verified: non-zero AND same count each frame (no accumulation)
    expect(result.firstCount).toBeGreaterThan(0)
    expect(result.firstCount).toBe(result.secondCount)
  })
})
