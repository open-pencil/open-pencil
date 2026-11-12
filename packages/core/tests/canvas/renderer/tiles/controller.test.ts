import { beforeAll, describe, expect, test } from 'bun:test'

import {
  color,
  createGridScene,
  isPending,
  renderFramesWhile,
  renderUntilSettled,
  steppedClock,
  stillController
} from '#core-tests/canvas/renderer/tiles/helpers'

import { getCanvasKit } from '@open-pencil/core/canvaskit'

import { TiledSceneController } from '#core/canvas/renderer/tiles'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

describe('tile scheduling', () => {
  test('fills the frame budget with tiles whose cost is not measured yet', () => {
    const { graph, surface, renderer } = createGridScene(ck)
    // A clock that never advances: every tile is free, so only the cost model can stop the frame.
    const controller = stillController()
    try {
      const first = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      expect(first.covered).toBe(true)
      expect(first.metrics.interruptibleCompleted).toBeGreaterThan(1)
      expect(first.metrics.skippedWithFallback).toBe(0)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('keeps rendered tiles when the content generation advances without node changes', () => {
    const { graph, surface, renderer } = createGridScene(ck)
    const controller = stillController()
    try {
      const result = renderFramesWhile(controller, { renderer, graph }, 10, isPending)
      expect(result.covered).toBe(true)
      // Overscan and then the backdrop are planned once the visible tiles exist; a free clock
      // finishes each stage in one frame, so a frame with no work means everything is rendered.
      const settled = renderFramesWhile(
        controller,
        { renderer, graph },
        5,
        (settled) => settled.metrics.interruptibleCompleted > 0
      )
      expect(settled.metrics.interruptibleCompleted).toBe(0)

      // requestRender() bumps the content generation without any node changing.
      const redraw = controller.renderFrame(renderer, surface.getCanvas(), graph, 2, 0)
      expect(redraw.covered).toBe(true)
      expect(redraw.pending).toBe(false)
      expect(redraw.metrics.interruptibleCompleted).toBe(0)
      expect(redraw.metrics.mandatoryCompleted).toBe(0)
      expect(redraw.metrics.cancelledJobs).toBe(0)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('zooms over the quantized step rendered mid-gesture and the exact level once it pauses', () => {
    const { graph, surface, renderer, pageId } = createGridScene(ck)
    const controller = stillController()
    try {
      const result = renderUntilSettled(controller, { renderer, graph })
      expect(result.covered).toBe(true)

      // The level moves: the quantized step above 1.3, √2, renders under the moving budget and
      // stands in for the exact level with the level-1 tiles.
      renderer.zoom = 1.3
      renderer.navigationPhase = 'zoom'
      const moving = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
      expect(moving.covered).toBe(false)
      expect(moving.metrics.interruptibleCompleted).toBeGreaterThan(0)
      expect(controller.isRendered({ pageId, level: 2 ** 0.5, x: 0, y: 0 })).toBe(true)
      expect(controller.isRendered({ pageId, level: 1.3, x: 0, y: 0 })).toBe(false)
      expect(moving.fallbackTileCount).toBeGreaterThan(0)
      expect(moving.uncoveredAreaCount).toBe(0)

      // The zoom pauses at that level: the exact level renders under the moving budget.
      const paused = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
      expect(paused.metrics.interruptibleCompleted).toBeGreaterThan(0)

      renderer.navigationPhase = 'idle'
      const settled = renderFramesWhile(
        controller,
        { renderer, graph },
        40,
        (settled) => !settled.covered,
        1,
        1
      )
      expect(settled.covered).toBe(true)
      expect(settled.fallbackTileCount).toBe(0)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('presents a new level once every visible tile exists, then tiles as they land', () => {
    const { graph, surface, renderer } = createGridScene(ck)
    // Free while settling; afterwards 10 ms a reading, so an idle frame renders one tile.
    const clock = steppedClock()
    const controller = new TiledSceneController({ now: clock.now })
    try {
      for (let frame = 0; frame < 12; frame++) {
        controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
      // At 1.3 the viewport is three by two tiles, all inside the settled level-1 area.
      clock.step = 10
      renderer.zoom = 1.3
      renderer.navigationPhase = 'zoom'
      controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
      renderer.navigationPhase = 'idle'
      const visibleTiles = 3 * 2
      let settling = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
      let frames = 0
      // The exact tiles rendered so far stay hidden: the whole viewport is still a stand-in.
      for (; !settling.covered && frames < 60; frames++) {
        expect(settling.fallbackTileCount).toBe(visibleTiles)
        expect(settling.uncoveredAreaCount).toBe(0)
        settling = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
      }
      expect(frames).toBeGreaterThan(1)
      expect(settling.covered).toBe(true)
      expect(settling.fallbackTileCount).toBe(0)

      // Committed, the level shows the tiles a pan reveals one by one over the stand-ins.
      renderer.panX = -600
      renderer.navigationPhase = 'pan'
      const panning = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 2)
      expect(panning.covered).toBe(false)
      expect(panning.fallbackTileCount).toBeGreaterThan(0)
      expect(panning.fallbackTileCount).toBeLessThan(visibleTiles)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('keeps the last complete level while a zoom renders through the cache budget', () => {
    const { graph, surface, renderer, pageId } = createGridScene(ck)
    const tileBytes = 512 * 512 * 4
    // Room for a few viewports: a zoom that renders a new step every frame fills it within a
    // few steps.
    const controller = new TiledSceneController({
      now: () => 0,
      tileCacheBudget: () => 48 * tileBytes
    })
    try {
      const result = renderUntilSettled(controller, { renderer, graph })
      expect(result.covered).toBe(true)

      renderer.navigationPhase = 'zoom'
      for (let step = 1; step <= 20; step++) {
        renderer.zoom = 1.15 ** step
        controller.renderFrame(renderer, surface.getCanvas(), graph, 1, step)
        expect(controller.isRendered({ pageId, level: 1, x: 0, y: 0 })).toBe(true)
      }
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('zooms out over a coarse copy of the whole page beyond the settled viewport', () => {
    const { graph, surface, renderer, pageId } = createGridScene(ck)
    // Content far outside the settled viewport: only the whole-page level can stand in for it.
    graph.createNode('RECTANGLE', pageId, {
      x: 3000,
      y: 3000,
      width: 40,
      height: 40,
      fills: color(1, 0, 0)
    })
    const clock = steppedClock()
    const controller = new TiledSceneController({ now: clock.now })
    try {
      const result = renderFramesWhile(controller, { renderer, graph }, 12, () => true)
      expect(result.pending).toBe(false)

      // At a quarter the viewport spans 5120 × 3200 world units: six tiles of 2048, four of
      // them inside the page's bounds, which the page level covers; the rest is empty canvas.
      clock.step = 10
      renderer.zoom = 0.25
      renderer.navigationPhase = 'zoom'
      const zoomed = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
      expect(zoomed.uncoveredContentAreaCount).toBe(0)
      expect(zoomed.uncoveredAreaCount).toBeLessThanOrEqual(2)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('zooms out over the coarse backdrop rendered around the settled viewport', () => {
    const { graph, surface, renderer } = createGridScene(ck)
    // Free while settling; once the zoom starts, 10 ms a reading, so one tile renders a frame.
    const clock = steppedClock()
    const controller = new TiledSceneController({ now: clock.now })
    try {
      // A free clock settles visible, overscan, and backdrop tiles within a few frames.
      const result = renderFramesWhile(controller, { renderer, graph }, 10, () => true)
      expect(result.covered).toBe(true)
      expect(result.pending).toBe(false)

      // Zoom out to half: the visible level has nothing beyond the old viewport, the backdrop has.
      clock.step = 10
      renderer.zoom = 0.5
      renderer.navigationPhase = 'zoom'
      const zoomed = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
      expect(zoomed.covered).toBe(false)
      expect(zoomed.uncoveredAreaCount).toBe(0)
      expect(zoomed.fallbackTileCount).toBeGreaterThan(0)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('counts areas no level covers and keeps a moving frame within its budget', () => {
    const { graph, surface, renderer } = createGridScene(ck)
    let time = 0
    const controller = new TiledSceneController({ now: () => (time += 10) })
    try {
      // Idle, the first job may overrun the budget so the frame makes progress, once its
      // chunk pictures are recorded.
      const idle = renderFramesWhile(
        controller,
        { renderer, graph },
        60,
        (idle) => idle.metrics.interruptibleCompleted === 0
      )
      // The 1280 × 800 viewport at level 1 is three by two tiles of 512. The page is first
      // shown whole, so the one tile stays hidden with the rest at the page colour.
      const visibleTiles = 3 * 2
      expect(idle.metrics.interruptibleCompleted).toBe(1)
      expect(idle.uncoveredAreaCount).toBe(visibleTiles)

      // Panning, a job estimated over the budget is skipped and the holes stay page colour.
      renderer.navigationPhase = 'pan'
      const panning = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
      expect(panning.metrics.interruptibleCompleted).toBe(0)
      // Every queued tile is too dear, and each is tried before the frame gives up.
      expect(panning.metrics.skippedWithFallback).toBe(visibleTiles - 1)
      expect(panning.fallbackTileCount).toBe(0)
      expect(panning.uncoveredAreaCount).toBe(visibleTiles)
      expect(panning.pending).toBe(true)

      // Idle again, the level presents once its last tile renders.
      renderer.navigationPhase = 'idle'
      let settled = panning
      for (let frame = 0; frame < 60 && !settled.covered; frame++) {
        settled = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
        expect(settled.uncoveredAreaCount).toBe(settled.covered ? 0 : visibleTiles)
      }
      expect(settled.covered).toBe(true)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test("records a tile's chunk pictures across frames when they exceed the budget", () => {
    const { graph, surface, renderer, pageId } = createGridScene(ck)
    // Every reading is 10 ms later, so a frame affords one chunk recording before deferring.
    let time = 0
    const controller = new TiledSceneController({ now: () => (time += 10) })
    try {
      const first = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      expect(first.metrics.deferredJobs).toBe(1)
      expect(first.metrics.interruptibleCompleted).toBe(0)
      expect(controller.isRendered({ pageId, level: 1, x: 1, y: 0 })).toBe(false)
      let result = first
      for (
        let frame = 0;
        frame < 60 && !controller.isRendered({ pageId, level: 1, x: 1, y: 0 });
        frame++
      ) {
        result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
      expect(controller.isRendered({ pageId, level: 1, x: 1, y: 0 })).toBe(true)
      expect(result.metrics.interruptibleCompleted).toBe(1)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('renders the tile under the viewport centre first', () => {
    const { graph, renderer, pageId } = createGridScene(ck)
    let time = 0
    const controller = new TiledSceneController({ now: () => (time += 10) })
    try {
      const result = renderFramesWhile(
        controller,
        { renderer, graph },
        60,
        (result) => result.metrics.interruptibleCompleted === 0
      )
      // The viewport spans world 0..1280 × 0..800: its centre lies in tile (1, 0).
      expect(result.metrics.interruptibleCompleted).toBe(1)
      expect(controller.isRendered({ pageId, level: 1, x: 1, y: 0 })).toBe(true)
      expect(controller.isRendered({ pageId, level: 1, x: 0, y: 0 })).toBe(false)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })
})
