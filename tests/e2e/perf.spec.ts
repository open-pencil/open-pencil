import { test, expect } from '@playwright/test'
import { CanvasHelper } from '../helpers/canvas'

const NODE_COUNT = 500
const ITERATIONS = 200

test.describe('Render performance', () => {
  let helper: CanvasHelper

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    helper = new CanvasHelper(page)
    await page.goto('http://localhost:1420/?test&no-chrome')
    await helper.waitForInit()

    await page.evaluate((count: number) => {
      const store = window.__OPEN_PENCIL_STORE__!
      const arr = new Uint8Array(count * 3)
      crypto.getRandomValues(arr)
      const cols = Math.ceil(Math.sqrt(count))
      for (let i = 0; i < count; i++) {
        const mod = i % 10
        const isVector = mod === 0
        const isEllipse = mod === 5
        const type = isVector ? ('VECTOR' as const) : isEllipse ? ('ELLIPSE' as const) : ('RECTANGLE' as const)
        const props: Record<string, unknown> = {
          x: (i % cols) * 60,
          y: Math.floor(i / cols) * 60,
          width: 50,
          height: 50,
          cornerRadius: type === 'RECTANGLE' ? 8 : 0,
          fills: [
            {
              type: 'SOLID',
              color: {
                r: arr[i * 3]! / 255,
                g: arr[i * 3 + 1]! / 255,
                b: arr[i * 3 + 2]! / 255,
                a: 1
              },
              visible: true,
              opacity: 1
            }
          ],
          strokes: [
            { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1, weight: 1 }
          ]
        }
        if (isVector) {
          props.vectorNetwork = {
            vertices: [
              { x: 0, y: 25 },
              { x: 25, y: 0 },
              { x: 50, y: 25 },
              { x: 25, y: 50 }
            ],
            segments: [
              { start: 0, end: 1, tangentStart: { x: 0, y: -15 }, tangentEnd: { x: -15, y: 0 } },
              { start: 1, end: 2, tangentStart: { x: 15, y: 0 }, tangentEnd: { x: 0, y: -15 } },
              { start: 2, end: 3, tangentStart: { x: 0, y: 15 }, tangentEnd: { x: 15, y: 0 } },
              { start: 3, end: 0, tangentStart: { x: -15, y: 0 }, tangentEnd: { x: 0, y: 15 } }
            ],
            regions: [{ loops: [[0, 1, 2, 3]], windingRule: 'NONZERO' as const }]
          }
        }
        store.graph.createNode(type, store.state.currentPageId, props)
      }
      store.requestRender()
    }, NODE_COUNT)

    await helper.waitForRender()
  })

  test.afterAll(async () => {
    await helper.page.close()
  })

  test('benchmark: synchronous render throughput', async () => {
    const results = await helper.page.evaluate((iterations: number) => {
      const store = window.__OPEN_PENCIL_STORE__!
      const renderer = store.renderer!

      function setupRenderer() {
        renderer.dpr = window.devicePixelRatio || 1
        renderer.panX = store.state.panX
        renderer.panY = store.state.panY
        renderer.zoom = store.state.zoom
        renderer.viewportWidth = 1280
        renderer.viewportHeight = 800
        renderer.showRulers = false
        renderer.pageColor = store.state.pageColor
        renderer.pageId = store.state.currentPageId
      }

      // Warm up
      setupRenderer()
      renderer.render(store.graph, store.state.selectedIds, {}, store.state.sceneVersion)
      renderer.render(store.graph, store.state.selectedIds, {}, store.state.sceneVersion)

      // Benchmark 1: Pan (repaint — picture cache hit)
      setupRenderer()
      const panStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        renderer.panX += 2
        renderer.panY += 1
        renderer.render(store.graph, store.state.selectedIds, {}, store.state.sceneVersion)
      }
      const panMs = performance.now() - panStart

      // Benchmark 2: Scene change (cache miss every frame)
      const nodes = [...store.graph.getNode(store.state.currentPageId)!.childIds]
      setupRenderer()
      const sceneStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        const node = store.graph.getNode(nodes[i % nodes.length]!)
        if (node) store.graph.updateNode(node.id, { x: node.x + 0.1 })
        store.state.sceneVersion++
        renderer.render(store.graph, store.state.selectedIds, {}, store.state.sceneVersion)
      }
      const sceneMs = performance.now() - sceneStart

      // Benchmark 3: Hover (volatile overlay, no caching)
      setupRenderer()
      const hoverStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        renderer.render(
          store.graph,
          store.state.selectedIds,
          { hoveredNodeId: nodes[i % nodes.length] },
          store.state.sceneVersion
        )
      }
      const hoverMs = performance.now() - hoverStart

      return {
        pan: { ms: Math.round(panMs * 100) / 100, avg: Math.round((panMs / iterations) * 100) / 100 },
        scene: { ms: Math.round(sceneMs * 100) / 100, avg: Math.round((sceneMs / iterations) * 100) / 100 },
        hover: { ms: Math.round(hoverMs * 100) / 100, avg: Math.round((hoverMs / iterations) * 100) / 100 }
      }
    }, ITERATIONS)

    console.log(`\n═══ RENDER BENCHMARK (${NODE_COUNT} nodes, ${ITERATIONS} iterations) ═══`)
    console.log(`  Pan (cache hit):    ${results.pan.avg}ms/frame  (${results.pan.ms}ms total)`)
    console.log(`  Scene change:       ${results.scene.avg}ms/frame  (${results.scene.ms}ms total)`)
    console.log(`  Hover (no cache):   ${results.hover.avg}ms/frame  (${results.hover.ms}ms total)`)
    console.log(`  Speedup (pan vs scene): ${(results.scene.avg / results.pan.avg).toFixed(1)}x`)
    console.log(`═══════════════════════════════════════════════════════\n`)

    expect(results.pan.avg).toBeLessThan(50)
  })

  test('benchmark: shadow rendering throughput', async () => {
    const SHADOW_NODES = 50
    const SHADOW_ITERS = 100

    const results = await helper.page.evaluate(
      ({ count, iterations }) => {
        const store = window.__OPEN_PENCIL_STORE__!
        const renderer = store.renderer!
        const graph = store.graph
        const pageId = store.state.currentPageId

        const shadowIds: string[] = []
        const cols = Math.ceil(Math.sqrt(count))
        for (let i = 0; i < count; i++) {
          const id = graph.createNode('RECTANGLE', pageId, {
            x: (i % cols) * 80,
            y: Math.floor(i / cols) * 80 + 2000,
            width: 60,
            height: 60,
            cornerRadius: 8,
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }],
            effects: [
              {
                type: 'DROP_SHADOW',
                color: { r: 0, g: 0, b: 0, a: 0.2 },
                offset: { x: 0, y: 4 },
                radius: 12,
                spread: 0,
                visible: true
              }
            ]
          })
          shadowIds.push(id)
        }

        function setupRenderer() {
          renderer.dpr = window.devicePixelRatio || 1
          renderer.panX = 0
          renderer.panY = -2000
          renderer.zoom = 1
          renderer.viewportWidth = 1280
          renderer.viewportHeight = 800
          renderer.showRulers = false
          renderer.pageColor = store.state.pageColor
          renderer.pageId = pageId
        }

        setupRenderer()
        renderer.render(graph, store.state.selectedIds, {}, store.state.sceneVersion)

        setupRenderer()
        const sceneStart = performance.now()
        for (let i = 0; i < iterations; i++) {
          const node = graph.getNode(shadowIds[i % shadowIds.length]!)
          if (node) graph.updateNode(node.id, { x: node.x + 0.1 })
          store.state.sceneVersion++
          renderer.render(graph, store.state.selectedIds, {}, store.state.sceneVersion)
        }
        const sceneMs = performance.now() - sceneStart

        for (const id of shadowIds) graph.deleteNode(id)

        return {
          scene: {
            ms: Math.round(sceneMs * 100) / 100,
            avg: Math.round((sceneMs / iterations) * 100) / 100
          }
        }
      },
      { count: SHADOW_NODES, iterations: SHADOW_ITERS }
    )

    console.log(
      `\n═══ SHADOW BENCHMARK (${SHADOW_NODES} shadow nodes, ${SHADOW_ITERS} iterations) ═══`
    )
    console.log(
      `  Scene change:  ${results.scene.avg}ms/frame  (${results.scene.ms}ms total)`
    )
    console.log(`═══════════════════════════════════════════════════════\n`)

    expect(results.scene.avg).toBeLessThan(50)
  })
})
