import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { seedLargeDocument } from '#tests/helpers/large-document'

type TimingSummary = {
  hitTestMissMs: number
  hitTestHitMs: number
  cachedFrameMs: number
  overlayFrameMs: number
  volatileFrameMs: number
  volatileMode: string
}

type PerformanceProfile = {
  timings: TimingSummary
  pointer: { calls: number; totalMs: number }
}

const SCALES = [500, 2000]
const profiles = new Map<number, PerformanceProfile>()

test.describe.serial('large-document performance', () => {
  for (const nodeCount of SCALES) {
    test(`profiles representative ${nodeCount}-node interactions`, async ({ page }, testInfo) => {
      test.setTimeout(120_000)
      await page.goto('/?test&no-chrome&no-rulers')
      const canvas = new CanvasHelper(page)
      await canvas.waitForInit()
      await canvas.clearCanvas()
      const fixture = await seedLargeDocument(page, nodeCount)
      await canvas.waitForRender()

      await page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const originalHitTest = store.graph.hitTest.bind(store.graph)
        let calls = 0
        let totalMs = 0
        store.graph.hitTest = ((...args) => {
          const startedAt = performance.now()
          const result = originalHitTest(...args)
          totalMs += performance.now() - startedAt
          calls++
          return result
        }) as typeof store.graph.hitTest
        Object.assign(window, {
          __largeDocumentPointerProfile: () => ({ calls, totalMs })
        })
      })
      const bounds = await canvas.canvas.boundingBox()
      if (!bounds) throw new Error('Canvas bounds unavailable')
      await page.mouse.move(bounds.x + 10, bounds.y + 10)
      await page.mouse.move(bounds.x + bounds.width - 10, bounds.y + bounds.height - 10, {
        steps: 40
      })
      const pointerProfile = await page.evaluate(() => {
        const profile = (
          window as typeof window & {
            __largeDocumentPointerProfile?: () => { calls: number; totalMs: number }
          }
        ).__largeDocumentPointerProfile
        return profile?.() ?? { calls: 0, totalMs: 0 }
      })

      const result = await page.evaluate((profile): Promise<TimingSummary> => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const renderer = store.renderer
        if (!renderer) throw new Error('OpenPencil renderer not initialized')
        const graph = store.graph
        const iterations = 50

        function average(run: () => void) {
          const startedAt = performance.now()
          for (let index = 0; index < iterations; index++) run()
          return (performance.now() - startedAt) / iterations
        }

        renderer.dpr = window.devicePixelRatio || 1
        renderer.panX = store.state.panX
        renderer.panY = store.state.panY
        renderer.zoom = store.state.zoom
        renderer.viewportWidth = 1280
        renderer.viewportHeight = 800
        renderer.showRulers = false
        renderer.pageColor = store.state.pageColor
        renderer.pageId = store.state.currentPageId
        renderer.render(graph, store.state.selectedIds, {}, store.state.sceneVersion)

        const lastId = profile.leafIds.at(-1)
        const lastNode = lastId ? graph.getNode(lastId) : null
        if (!lastNode) throw new Error('Large-document target not found')
        const lastPosition = graph.getAbsolutePosition(lastNode.id)

        const hitTestMissMs = average(() => {
          graph.hitTest(
            profile.worldWidth + 100,
            profile.worldHeight + 100,
            store.state.currentPageId
          )
        })
        const hitTestHitMs = average(() => {
          graph.hitTest(
            lastPosition.x + lastNode.width / 2,
            lastPosition.y + lastNode.height / 2,
            store.state.currentPageId
          )
        })
        const cachedFrameMs = average(() => {
          renderer.render(graph, store.state.selectedIds, {}, store.state.sceneVersion)
        })
        const overlayFrameMs = average(() => {
          renderer.render(
            graph,
            store.state.selectedIds,
            { hoveredNodeId: lastNode.id },
            store.state.sceneVersion
          )
        })
        const volatileFrameMs = average(() => {
          renderer.render(
            graph,
            store.state.selectedIds,
            { rotationPreview: { nodeId: lastNode.id, angle: 1 } },
            store.state.sceneVersion
          )
        })

        return {
          hitTestMissMs,
          hitTestHitMs,
          cachedFrameMs,
          overlayFrameMs,
          volatileFrameMs,
          volatileMode: renderer.profiler.stats.scenePictureMode
        }
      }, fixture)

      const profile = { timings: result, pointer: pointerProfile }
      profiles.set(nodeCount, profile)
      await testInfo.attach(`large-document-${nodeCount}.json`, {
        body: JSON.stringify(profile, null, 2),
        contentType: 'application/json'
      })

      expect(fixture.nodeCount).toBe(nodeCount)
      expect(pointerProfile.calls).toBeGreaterThan(0)
      expect(result.volatileMode).toBe('volatile')
      expect(result.hitTestMissMs).toBeGreaterThanOrEqual(0)
      expect(result.hitTestHitMs).toBeGreaterThanOrEqual(0)
      expect(result.cachedFrameMs).toBeGreaterThanOrEqual(0)
      expect(result.overlayFrameMs).toBeGreaterThanOrEqual(0)
      expect(result.volatileFrameMs).toBeGreaterThanOrEqual(0)

      const smallerProfile = profiles.get(SCALES[0])
      if (nodeCount !== SCALES[0] && smallerProfile) {
        const scaleRatio = nodeCount / SCALES[0]
        expect(result.hitTestMissMs).toBeLessThanOrEqual(
          Math.max(smallerProfile.timings.hitTestMissMs * scaleRatio * 2, 1)
        )
        expect(pointerProfile.totalMs).toBeLessThanOrEqual(
          Math.max(smallerProfile.pointer.totalMs * scaleRatio * 2, 10)
        )
      }
      expect(canvas.errors.filter((error) => !error.includes('127.0.0.1:7600'))).toEqual([])
    })
  }
})
