import { test, expect, type BrowserContext } from '@playwright/test'

import type { SceneNode } from '@open-pencil/core/scene-graph'

import { CanvasHelper, cleanupCanvasTestPage } from '#tests/helpers/canvas'

/** Renderer internal properties accessed by text LOD tests */
interface TextLodInternals {
  minScreenSizeForText: number
  _textLodCulledCount: number
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEXT LOD SIMPLIFICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Properties tested (minScreenSizeForText, _textLodCulledCount) exist
// on the SkiaRenderer (renderer.ts:254-294). minScreenSizeForText
// controls the minimum screen-space area (px²) for text nodes below
// which they render as simplified semi-transparent rectangles instead
// of full paragraphs. _textLodCulledCount is a counter incremented
// when text is LOD-culled (simplified to rect).

const TEXT_NODE_COUNT = 5000

test.describe('Text LOD Simplification', () => {
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

    // Create a grid of TEXT nodes — text-heavy document for LOD measurement
    await page.evaluate((count: number) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('openPencil store not available')
      const cols = Math.ceil(Math.sqrt(count))
      for (let i = 0; i < count; i++) {
        const x = (i % cols) * 100
        const y = Math.floor(i / cols) * 100
        const texts = [
          'Hello World',
          'The quick brown fox',
          'Lorem ipsum dolor',
          'Text rendering',
          'Skia CanvasKit',
          'Design editor',
          'Typography test'
        ]
        store.graph.createNode('TEXT', store.state.currentPageId, {
          x,
          y,
          width: 200,
          height: 24,
          text: texts[i % texts.length],
          fontSize: 14,
          fontName: { family: 'Inter', style: 'Regular' },
          textAutoResize: 'WIDTH_AND_HEIGHT',
          fills: [
            {
              type: 'SOLID',
              color: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
              visible: true,
              opacity: 1
            }
          ],
          effects: [],
          opacity: 1,
          visible: true
        } as Partial<SceneNode>)
      }
      store.requestRender()
    }, TEXT_NODE_COUNT)

    await helper.waitForRender()
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

  test('minScreenSizeForText property exists', async () => {
    const exists = await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('openPencil store not available')
      return 'minScreenSizeForText' in store.renderer
    })
    expect(exists).toBe(true)
  })

  test('_textLodCulledCount property exists', async () => {
    const exists = await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('openPencil store not available')
      return '_textLodCulledCount' in store.renderer
    })
    expect(exists).toBe(true)
  })

  const TXT_CENTER_X = 3550
  const TXT_CENTER_Y = 3550
  const WARMUP = 5
  const MEASURE = 30

  /**
   * Text nodes below readable threshold render as simplified rect.
   *
   * 5000 text nodes at 10% zoom: 200×24 × 0.1² = 4.8px² screen area.
   * With minScreenSizeForText = 100, all text should be LOD-culled.
   * Expect _textLodCulledCount > 0 after render.
   */
  test('text nodes below readable threshold render as simplified rect', async () => {
    const result = await helper.page.evaluate(
      ({ zoom, centerX, centerY, width, height, warmup, measure }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer as TextLodInternals
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

        // Base LOD disabled — text-specific LOD handles culling
        renderer.minScreenSize = 0
        // Text LOD: skip paragraph construction for text < 100px² on screen
        renderer.minScreenSizeForText = 100

        const v = store.state.sceneVersion + 1
        store.state.sceneVersion = v

        for (let i = 0; i < warmup; i++) {
          renderer.render(graph, store.state.selectedIds, {}, v)
        }

        const times: number[] = []
        let textLodCulled = 0
        let lodCulled = 0
        for (let i = 0; i < measure; i++) {
          const start = performance.now()
          renderer.render(graph, store.state.selectedIds, {}, v)
          times.push(performance.now() - start)
          textLodCulled = renderer._textLodCulledCount ?? -1
          lodCulled = renderer._lodCulledCount
        }

        const relevant = times.slice(1)
        return {
          avgMs: Math.round((relevant.reduce((a, b) => a + b, 0) / relevant.length) * 100) / 100,
          nodeCount: renderer._nodeCount,
          culledCount: renderer._culledCount,
          lodCulledCount: lodCulled,
          textLodCulledCount: textLodCulled
        }
      },
      {
        zoom: 0.1,
        centerX: TXT_CENTER_X,
        centerY: TXT_CENTER_Y,
        width: 1920,
        height: 1080,
        warmup: WARMUP,
        measure: MEASURE
      }
    )

    // _textLodCulledCount > 0 means text nodes were LOD-culled at 10% zoom
    expect(result.textLodCulledCount).toBeGreaterThan(0)
  })

  /**
   * Text nodes above threshold still render as full Paragraph.
   *
   * At 100% zoom, 200×24 text nodes = 4800px² on screen >> 100px² threshold.
   * All text nodes should render as full Paragraphs.
   * Expect _textLodCulledCount === 0.
   */
  test('text nodes above threshold still render as full Paragraph', async () => {
    const result = await helper.page.evaluate(
      ({ zoom, centerX, centerY, width, height, warmup, measure }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer as TextLodInternals
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

        renderer.minScreenSize = 0
        renderer.minScreenSizeForText = 100

        const v = store.state.sceneVersion + 1
        store.state.sceneVersion = v

        for (let i = 0; i < warmup; i++) {
          renderer.render(graph, store.state.selectedIds, {}, v)
        }

        const times: number[] = []
        let textLodCulled = 0
        for (let i = 0; i < measure; i++) {
          const start = performance.now()
          renderer.render(graph, store.state.selectedIds, {}, v)
          times.push(performance.now() - start)
          textLodCulled = renderer._textLodCulledCount ?? -1
        }

        const relevant = times.slice(1)
        return {
          avgMs: Math.round((relevant.reduce((a, b) => a + b, 0) / relevant.length) * 100) / 100,
          textLodCulledCount: textLodCulled
        }
      },
      {
        zoom: 1.0,
        centerX: TXT_CENTER_X,
        centerY: TXT_CENTER_Y,
        width: 1920,
        height: 1080,
        warmup: WARMUP,
        measure: MEASURE
      }
    )

    expect(result.textLodCulledCount).toBe(0)
  })

  /**
   * Text LOD disabled when minScreenSizeForText = 0 (default).
   *
   * At 10% zoom with text LOD disabled, all text renders as Paragraph.
   * Expect _textLodCulledCount === 0.
   */
  test('text LOD disabled when minScreenSizeForText = 0', async () => {
    const result = await helper.page.evaluate(
      ({ zoom, centerX, centerY, width, height, warmup, measure }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer as TextLodInternals
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

        renderer.minScreenSize = 0
        renderer.minScreenSizeForText = 0 // disabled

        const v = store.state.sceneVersion + 1
        store.state.sceneVersion = v

        for (let i = 0; i < warmup; i++) {
          renderer.render(graph, store.state.selectedIds, {}, v)
        }

        const times: number[] = []
        let textLodCulled = 0
        for (let i = 0; i < measure; i++) {
          const start = performance.now()
          renderer.render(graph, store.state.selectedIds, {}, v)
          times.push(performance.now() - start)
          textLodCulled = renderer._textLodCulledCount ?? -1
        }

        const relevant = times.slice(1)
        return {
          avgMs: Math.round((relevant.reduce((a, b) => a + b, 0) / relevant.length) * 100) / 100,
          textLodCulledCount: textLodCulled
        }
      },
      {
        zoom: 0.1,
        centerX: TXT_CENTER_X,
        centerY: TXT_CENTER_Y,
        width: 1920,
        height: 1080,
        warmup: WARMUP,
        measure: MEASURE
      }
    )

    expect(result.textLodCulledCount).toBe(0)
  })

  /**
   * Text LOD reduces frame time at 10% zoom vs disabled.
   *
   * Compare frame times with text LOD enabled vs disabled at 10% zoom.
   * Enabled should be faster (text nodes become simple rects instead of paragraphs).
   */
  test('text LOD reduces frame time at 10% zoom vs disabled', async () => {
    const result = await helper.page.evaluate(
      ({ zoom, centerX, centerY, width, height, warmup, measure }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer as TextLodInternals
        const graph = store.graph

        function measureFrameTime(minScreenSizeForText: number): number {
          renderer.dpr = window.devicePixelRatio || 1
          renderer.viewportWidth = width
          renderer.viewportHeight = height
          renderer.zoom = zoom
          renderer.panX = width / 2 - centerX * zoom
          renderer.panY = height / 2 - centerY * zoom
          renderer.showRulers = false
          renderer.pageColor = store.state.pageColor
          renderer.pageId = store.state.currentPageId
          renderer.minScreenSize = 0
          renderer.minScreenSizeForText = minScreenSizeForText

          const v = store.state.sceneVersion + 1
          store.state.sceneVersion = v

          for (let i = 0; i < warmup; i++) {
            renderer.render(graph, store.state.selectedIds, {}, v)
          }

          const times: number[] = []
          for (let i = 0; i < measure; i++) {
            const start = performance.now()
            renderer.render(graph, store.state.selectedIds, {}, v)
            times.push(performance.now() - start)
          }

          const relevant = times.slice(1)
          return Math.round((relevant.reduce((a, b) => a + b, 0) / relevant.length) * 100) / 100
        }

        const disabledMs = measureFrameTime(0)
        const enabledMs = measureFrameTime(100)

        return { disabledMs, enabledMs }
      },
      {
        zoom: 0.1,
        centerX: TXT_CENTER_X,
        centerY: TXT_CENTER_Y,
        width: 1920,
        height: 1080,
        warmup: WARMUP,
        measure: MEASURE
      }
    )

    // With text LOD enabled, frame time should be less than disabled
    expect(result.enabledMs).toBeLessThan(result.disabledMs)
    // Expect meaningful improvement: at least 20% faster
    expect(result.enabledMs).toBeLessThan(result.disabledMs * 0.8)
  })

  /**
   * _textLodCulledCount resets between renders (no accumulation bug).
   *
   * Two consecutive renders must produce the same count, not double.
   * This is a regression test parallel to the accumulation test for base LOD.
   */
  test('regression: _textLodCulledCount does not accumulate across frames', async () => {
    const result = await helper.page.evaluate(
      ({ zoom, centerX, centerY, width, height }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer as TextLodInternals
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
        renderer.minScreenSize = 0
        renderer.minScreenSizeForText = 100

        const v = store.state.sceneVersion + 1
        store.state.sceneVersion = v

        renderer.render(graph, store.state.selectedIds, {}, v)
        const firstCount = renderer._textLodCulledCount ?? -1

        renderer.render(graph, store.state.selectedIds, {}, v)
        const secondCount = renderer._textLodCulledCount ?? -1

        return { firstCount, secondCount }
      },
      { zoom: 0.1, centerX: TXT_CENTER_X, centerY: TXT_CENTER_Y, width: 1920, height: 1080 }
    )

    // Both counts should be non-zero and identical (no accumulation)
    expect(result.firstCount).toBeGreaterThan(0)
    expect(result.firstCount).toBe(result.secondCount)
  })
})
