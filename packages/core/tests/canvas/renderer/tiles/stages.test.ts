import { beforeAll, describe, expect, test } from 'bun:test'

import {
  createGridScene,
  renderFramesWhile,
  steppedClock,
  stillController
} from '#core-tests/canvas/renderer/tiles/helpers'

import { getCanvasKit } from '@open-pencil/core/canvaskit'

import { TiledSceneController } from '#core/canvas/renderer/tiles'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

describe('background tile stages', () => {
  test('reports background work until the ring, page copy, pyramid, and backdrop are built', () => {
    const { graph, surface, renderer } = createGridScene(ck)
    const controller = stillController()
    try {
      let result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      expect(result.covered).toBe(true)
      expect(result.pending).toBe(false)
      expect(result.backgroundPending).toBe(true)
      let frames = 0
      while (result.backgroundPending && frames < 20) {
        result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
        frames++
      }
      expect(result.backgroundPending).toBe(false)
      expect(frames).toBeGreaterThan(1)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('sizes the tile cache to the viewport and stops background work a smaller one cannot hold', () => {
    const { graph, surface, renderer } = createGridScene(ck)
    const tileBytes = 512 * 512 * 4
    const sized = stillController()
    try {
      sized.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      // 1280 × 800 at DPR 1 is 3 × 2 tiles plus one each way; five viewports of those stay
      // under the 128 MB floor, which a DPR 2 viewport twice as large passes.
      expect(sized.tileCacheBytes()).toBe(128 * 1024 * 1024)
      renderer.dpr = 2
      renderer.viewportWidth = 2560
      renderer.viewportHeight = 1600
      sized.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      expect(sized.tileCacheBytes()).toBe(11 * 8 * tileBytes * 5)
    } finally {
      sized.destroy()
    }
    renderer.dpr = 1
    renderer.viewportWidth = 1280
    renderer.viewportHeight = 800
    // Room for the six visible tiles and little else: the ring would evict them.
    const small = new TiledSceneController({ now: () => 0, tileCacheBudget: () => 8 * tileBytes })
    try {
      let result = small.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      expect(result.covered).toBe(true)
      let frames = 0
      while (result.backgroundPending && frames < 20) {
        result = small.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
        frames++
      }
      expect(result.backgroundPending).toBe(false)
      expect(frames).toBeLessThan(20)
      // The visible tiles survived the attempt, and idle frames stay idle.
      const idle = small.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      expect(idle.covered).toBe(true)
      expect(idle.metrics.interruptibleCompleted).toBe(0)
      expect(idle.backgroundPending).toBe(false)
    } finally {
      small.destroy()
      renderer.destroy()
    }
  })

  test('builds a pyramid of downsampled levels once the visible level settles', () => {
    const { graph, surface, renderer, pageId } = createGridScene(ck)
    const clock = steppedClock()
    const controller = new TiledSceneController({ now: clock.now })
    try {
      const result = renderFramesWhile(controller, { renderer, graph }, 12, () => true)
      expect(result.covered).toBe(true)
      expect(result.pending).toBe(false)
      // The 1280×800 viewport at level 1 is five by four tiles; its halves exist down to one tile.
      expect(controller.isRendered({ pageId, level: 0.5, x: 0, y: 0 })).toBe(true)
      expect(controller.isRendered({ pageId, level: 0.25, x: 0, y: 0 })).toBe(true)
      expect(controller.isRendered({ pageId, level: 0.125, x: 0, y: 0 })).toBe(true)

      // Far out, the pyramid still stands in for everything that was rendered.
      clock.step = 10
      renderer.zoom = 1 / 16
      renderer.navigationPhase = 'zoom'
      const zoomed = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
      expect(zoomed.fallbackTileCount).toBeGreaterThan(0)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })
})
