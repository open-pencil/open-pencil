import { test, expect, type BrowserContext } from '@playwright/test'

import type { SceneNode } from '@open-pencil/core/scene-graph'

import {
  CanvasHelper,
  cleanupCanvasTestPage,
  isIgnorableTeardownError
} from '#tests/helpers/canvas'

/** Renderer internal properties accessed by effect LOD tests */
interface EffectLodInternals {
  minScreenSizeForEffects: number
  _effectLodCulledCount: number
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EFFECT LOD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Properties tested (minScreenSizeForEffects, _effectLodCulledCount)
// exist on the SkiaRenderer (renderer.ts:254-294). Effect LOD skips
// expensive shadow/blur saveLayer operations for nodes that are above
// the base render threshold but too small for their effects to be
// visually meaningful.

const EFFECT_NODE_COUNT = 500

test.describe('Effect LOD', () => {
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

    // Create nodes with drop shadows — effects are expensive saveLayer ops
    await page.evaluate((count: number) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('openPencil store not available')
      const cols = Math.ceil(Math.sqrt(count))
      for (let i = 0; i < count; i++) {
        const x = (i % cols) * 120
        const y = Math.floor(i / cols) * 120
        store.graph.createNode('RECTANGLE', store.state.currentPageId, {
          x,
          y,
          width: 30,
          height: 30,
          fills: [
            {
              type: 'SOLID',
              color: { r: 0.3, g: 0.5, b: 0.8, a: 1 },
              visible: true,
              opacity: 1
            }
          ],
          effects: [
            {
              type: 'DROP_SHADOW',
              visible: true,
              radius: 8,
              offset: { x: 4, y: 4 },
              color: { r: 0, g: 0, b: 0, a: 0.3 },
              blendMode: 'NORMAL',
              spread: 0
            }
          ],
          opacity: 1,
          visible: true
        } as Partial<SceneNode>)
      }
      store.requestRender()
    }, EFFECT_NODE_COUNT)

    await helper.waitForRender()
    await helper.waitForRender()
    await helper.waitForRender()
  })

  test.afterAll(async () => {
    test.setTimeout(120_000)
    await cleanupCanvasTestPage(helper)
    // Close the entire context (not just the page) to release all WebGL
    // resources and prevent context exhaustion for subsequent tests.
    // cleanupCanvasTestPage already closes the page, so just close the context.
    if (context) {
      try {
        await context.close()
      } catch (error) {
        if (!isIgnorableTeardownError(error)) throw error
      }
    }
  })

  // ── Property existence checks ──

  test('minScreenSizeForEffects property exists', async () => {
    const exists = await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('openPencil store not available')
      return 'minScreenSizeForEffects' in store.renderer
    })
    expect(exists).toBe(true)
  })

  test('_effectLodCulledCount property exists', async () => {
    const exists = await helper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('openPencil store not available')
      return '_effectLodCulledCount' in store.renderer
    })
    expect(exists).toBe(true)
  })

  // ── Behavioral tests ──

  const EFF_CENTER_X = 3000
  const EFF_CENTER_Y = 3000
  const WARMUP = 5
  const MEASURE = 30

  /**
   * Effects skipped for nodes below effect threshold but above render threshold.
   *
   * 30×30 nodes at 25% zoom = 56px² screen area.
   * minScreenSize = 4 → nodes WILL render (56 > 4)
   * minScreenSizeForEffects = 100 → effects SKIPPED (56 < 100)
   * Expect _effectLodCulledCount > 0.
   */
  test('effects skipped for nodes below effect threshold', async () => {
    const result = await helper.page.evaluate(
      ({ zoom, centerX, centerY, width, height, warmup, measure }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer as EffectLodInternals
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

        // Base LOD: nodes at 56px² > 4px² → they render
        renderer.minScreenSize = 4
        // Effect LOD: nodes at 56px² < 100px² → effects skipped
        renderer.minScreenSizeForEffects = 100

        const v = store.state.sceneVersion + 1
        store.state.sceneVersion = v

        for (let i = 0; i < warmup; i++) {
          renderer.render(graph, store.state.selectedIds, {}, v)
        }

        const times: number[] = []
        let effectLodCulled = 0
        for (let i = 0; i < measure; i++) {
          const start = performance.now()
          renderer.render(graph, store.state.selectedIds, {}, v)
          times.push(performance.now() - start)
          effectLodCulled = renderer._effectLodCulledCount ?? -1
        }

        const relevant = times.slice(1)
        return {
          avgMs: Math.round((relevant.reduce((a, b) => a + b, 0) / relevant.length) * 100) / 100,
          nodeCount: renderer._nodeCount,
          effectLodCulledCount: effectLodCulled
        }
      },
      {
        zoom: 0.25,
        centerX: EFF_CENTER_X,
        centerY: EFF_CENTER_Y,
        width: 1920,
        height: 1080,
        warmup: WARMUP,
        measure: MEASURE
      }
    )

    // 30×30 at 25% zoom = 56px² < 100px² threshold → all effects skipped
    expect(result.effectLodCulledCount).toBeGreaterThan(0)
  })

  test('effects retained for nodes above effect threshold', async () => {
    const result = await helper.page.evaluate(
      ({ zoom, centerX, centerY, width, height, warmup, measure }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer as EffectLodInternals
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
        renderer.minScreenSizeForEffects = 100

        const v = store.state.sceneVersion + 1
        store.state.sceneVersion = v

        for (let i = 0; i < warmup; i++) {
          renderer.render(graph, store.state.selectedIds, {}, v)
        }

        let effectLodCulled = 0
        for (let i = 0; i < measure; i++) {
          renderer.render(graph, store.state.selectedIds, {}, v)
          effectLodCulled = renderer._effectLodCulledCount ?? -1
        }

        return { effectLodCulledCount: effectLodCulled }
      },
      {
        zoom: 1.0,
        centerX: EFF_CENTER_X,
        centerY: EFF_CENTER_Y,
        width: 1920,
        height: 1080,
        warmup: WARMUP,
        measure: MEASURE
      }
    )

    expect(result.effectLodCulledCount).toBe(0)
  })

  test('effect LOD disabled when minScreenSizeForEffects = 0', async () => {
    const result = await helper.page.evaluate(
      ({ zoom, centerX, centerY, width, height, warmup, measure }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('openPencil store not available')
        const renderer = store.renderer as EffectLodInternals
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
        renderer.minScreenSizeForEffects = 0 // disabled

        const v = store.state.sceneVersion + 1
        store.state.sceneVersion = v

        for (let i = 0; i < warmup; i++) {
          renderer.render(graph, store.state.selectedIds, {}, v)
        }

        let effectLodCulled = 0
        for (let i = 0; i < measure; i++) {
          renderer.render(graph, store.state.selectedIds, {}, v)
          effectLodCulled = renderer._effectLodCulledCount ?? -1
        }

        return { effectLodCulledCount: effectLodCulled }
      },
      {
        zoom: 0.25,
        centerX: EFF_CENTER_X,
        centerY: EFF_CENTER_Y,
        width: 1920,
        height: 1080,
        warmup: WARMUP,
        measure: MEASURE
      }
    )

    expect(result.effectLodCulledCount).toBe(0)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EFFECT LOD: LAYER BLUR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LAYER_BLUR effects use a different code path in renderNode()
// (saveLayer with blur filter) than DROP_SHADOW effects
// (renderEffects via renderShapeUncached). Both must respect
// minScreenSizeForEffects.

test.describe('Effect LOD — Layer Blur', () => {
  test.describe.configure({ timeout: 180_000 })

  let blHelper: CanvasHelper
  let blContext: BrowserContext

  test.beforeAll(async ({ browser }) => {
    blContext = await browser.newContext()
    const page = await blContext.newPage()
    blHelper = new CanvasHelper(page)
    await page.goto('/?test&no-chrome')
    await blHelper.waitForInit()
  })

  test.afterAll(async () => {
    test.setTimeout(30_000)
    if (blContext) {
      try {
        await blContext.close()
      } catch (error) {
        if (!isIgnorableTeardownError(error)) throw error
      }
    }
  })

  test('layer blur LOD: effects skipped at 10% zoom, retained at 100%', async () => {
    // Create layer blur nodes and test both zoom levels in a single evaluate call
    const result = await blHelper.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('openPencil store not available')
      const graph = store.graph
      const renderer = store.renderer as EffectLodInternals

      // Create 64 layer blur nodes (8×8 grid) — small enough to avoid
      // picture cache threshold issues
      const N = 64
      const cols = Math.ceil(Math.sqrt(N))
      for (let i = 0; i < N; i++) {
        const x = (i % cols) * 40
        const y = Math.floor(i / cols) * 40
        graph.createNode('RECTANGLE', store.state.currentPageId, {
          x,
          y,
          width: 30,
          height: 30,
          fills: [
            {
              type: 'SOLID',
              color: { r: 0.8, g: 0.3, b: 0.3, a: 1 },
              visible: true,
              opacity: 1
            }
          ],
          effects: [
            {
              type: 'LAYER_BLUR',
              visible: true,
              radius: 10,
              color: { r: 0, g: 0, b: 0, a: 0 },
              blendMode: 'NORMAL'
            }
          ],
          opacity: 1,
          visible: true
        } as Partial<SceneNode>)
      }

      function measure(zoom: number, minSize: number): { avgMs: number; effectLodCulled: number } {
        renderer.dpr = window.devicePixelRatio || 1
        renderer.viewportWidth = 1920
        renderer.viewportHeight = 1080
        renderer.zoom = zoom
        renderer.panX = 1920 / 2 - 160 * zoom
        renderer.panY = 1080 / 2 - 160 * zoom
        renderer.showRulers = false
        renderer.pageColor = store.state.pageColor
        renderer.pageId = store.state.currentPageId
        renderer.minScreenSize = 0
        renderer.minScreenSizeForEffects = minSize

        const v = store.state.sceneVersion + 1
        store.state.sceneVersion = v

        // Force direct-render path by disabling picture cache
        // (set minScreenSize then render to invalidate)
        for (let i = 0; i < 3; i++) {
          renderer.render(graph, store.state.selectedIds, {}, v)
        }

        const times: number[] = []
        let effectLodCulled = 0
        for (let i = 0; i < 5; i++) {
          const start = performance.now()
          renderer.render(graph, store.state.selectedIds, {}, v)
          times.push(performance.now() - start)
          effectLodCulled = renderer._effectLodCulledCount ?? -1
        }

        return {
          avgMs: Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 100) / 100,
          effectLodCulled
        }
      }

      const at10pct = measure(0.1, 100)
      const at100pct = measure(1.0, 100)

      return {
        at10pct_effectLodCulled: at10pct.effectLodCulled,
        at10pct_avgMs: at10pct.avgMs,
        at100pct_effectLodCulled: at100pct.effectLodCulled
      }
    })

    // At 10% zoom: 30×30 nodes = 9px² < 100px² → effects skipped
    expect(result.at10pct_effectLodCulled).toBeGreaterThan(0)
    // At 100% zoom: 30×30 nodes = 900px² > 100px² → effects retained
    expect(result.at100pct_effectLodCulled).toBe(0)
  })
})
