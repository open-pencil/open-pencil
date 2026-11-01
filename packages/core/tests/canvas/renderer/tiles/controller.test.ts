import { beforeAll, describe, expect, mock, test } from 'bun:test'

import type { Surface } from 'canvaskit-wasm'

import { expectDefined } from '#core-tests/helpers/assert'

import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'

import { SkiaRenderer } from '#core/canvas'
import type { ImagePreview, ImagePreviewDecoder } from '#core/canvas/images/previews'
import { TiledSceneController } from '#core/canvas/renderer/tiles'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

function color(r: number, g: number, b: number) {
  return [{ type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }]
}

function createGridScene() {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  for (let index = 0; index < 48; index++) {
    graph.createNode('RECTANGLE', page.id, {
      x: (index % 12) * 100,
      y: Math.floor(index / 12) * 100,
      width: 80,
      height: 80,
      fills: color(0.2, 0.4, 0.8)
    })
  }
  const surface = expectDefined(ck.MakeSurface(1280, 800), 'scheduling surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.pageId = page.id
  renderer.pageColor = { r: 1, g: 1, b: 1, a: 1 }
  renderer.viewportWidth = 1280
  renderer.viewportHeight = 800
  renderer.dpr = 1
  renderer.zoom = 1
  renderer.navigationPhase = 'idle'
  return { graph, surface, renderer, pageId: page.id }
}

/** The red, green, and blue of the surface's pixel at `x`, `y`, after a flush. */
function pixelAt(surface: Surface, x: number, y: number): number[] {
  surface.flush()
  const image = surface.makeImageSnapshot()
  const pixels = expectDefined(
    image.readPixels(x, y, {
      width: 1,
      height: 1,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    }),
    'pixel'
  )
  image.delete()
  return Array.from(pixels as Uint8Array).slice(0, 3)
}

describe('tile scheduling', () => {
  test('fills the frame budget with tiles whose cost is not measured yet', () => {
    const { graph, surface, renderer } = createGridScene()
    // A clock that never advances: every tile is free, so only the cost model can stop the frame.
    const controller = new TiledSceneController({ now: () => 0 })
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
    const { graph, surface, renderer } = createGridScene()
    const controller = new TiledSceneController({ now: () => 0 })
    try {
      let result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      for (let frame = 0; frame < 10 && result.pending; frame++) {
        result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
      expect(result.covered).toBe(true)
      // Overscan and then the backdrop are planned once the visible tiles exist; a free clock
      // finishes each stage in one frame, so a frame with no work means everything is rendered.
      let settled = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      for (let frame = 0; frame < 5 && settled.metrics.interruptibleCompleted > 0; frame++) {
        settled = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
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
    const { graph, surface, renderer, pageId } = createGridScene()
    const controller = new TiledSceneController({ now: () => 0 })
    try {
      let result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      for (let frame = 0; frame < 30 && (result.pending || result.backgroundPending); frame++) {
        result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
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
      let settled = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
      for (let frame = 0; frame < 40 && !settled.covered; frame++) {
        settled = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
      }
      expect(settled.covered).toBe(true)
      expect(settled.fallbackTileCount).toBe(0)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('presents a new level once every visible tile exists, then tiles as they land', () => {
    const { graph, surface, renderer } = createGridScene()
    // Free while settling; afterwards 10 ms a reading, so an idle frame renders one tile.
    let step = 0
    let time = 0
    const controller = new TiledSceneController({ now: () => (time += step) })
    try {
      for (let frame = 0; frame < 12; frame++) {
        controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
      // At 1.3 the viewport is three by two tiles, all inside the settled level-1 area.
      step = 10
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

  test('zooms out over a coarse copy of the whole page beyond the settled viewport', () => {
    const { graph, surface, renderer, pageId } = createGridScene()
    // Content far outside the settled viewport: only the whole-page level can stand in for it.
    graph.createNode('RECTANGLE', pageId, {
      x: 3000,
      y: 3000,
      width: 40,
      height: 40,
      fills: color(1, 0, 0)
    })
    let step = 0
    let time = 0
    const controller = new TiledSceneController({ now: () => (time += step) })
    try {
      let result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      for (let frame = 0; frame < 12; frame++) {
        result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
      expect(result.pending).toBe(false)

      // At a quarter the viewport spans 5120 × 3200 world units: six tiles of 2048, four of
      // them inside the page's bounds, which the page level covers; the rest is empty canvas.
      step = 10
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
    const { graph, surface, renderer } = createGridScene()
    // Free while settling; once the zoom starts, 10 ms a reading, so one tile renders a frame.
    let step = 0
    let time = 0
    const controller = new TiledSceneController({ now: () => (time += step) })
    try {
      // A free clock settles visible, overscan, and backdrop tiles within a few frames.
      let result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      for (let frame = 0; frame < 10; frame++) {
        result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
      expect(result.covered).toBe(true)
      expect(result.pending).toBe(false)

      // Zoom out to half: the visible level has nothing beyond the old viewport, the backdrop has.
      step = 10
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
    const { graph, surface, renderer } = createGridScene()
    let time = 0
    const controller = new TiledSceneController({ now: () => (time += 10) })
    try {
      // Idle, the first job may overrun the budget so the frame makes progress, once its
      // chunk pictures are recorded.
      let idle = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      for (let frame = 0; frame < 60 && idle.metrics.interruptibleCompleted === 0; frame++) {
        idle = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
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
})

describe('tiles with image previews', () => {
  function encodedSquare(r: number, g: number, b: number): Uint8Array {
    const surface = expectDefined(ck.MakeSurface(8, 8), 'image surface')
    surface.getCanvas().clear(ck.Color4f(r, g, b, 1))
    surface.flush()
    const image = surface.makeImageSnapshot()
    const bytes = expectDefined(image.encodeToBytes(ck.ImageFormat.PNG, 100), 'image PNG')
    image.delete()
    surface.delete()
    return bytes
  }

  function centerPixel(renderer: SkiaRenderer): number[] {
    const surface = renderer.surface
    surface.flush()
    const image = surface.makeImageSnapshot()
    const pixels = expectDefined(
      image.readPixels(160, 120, {
        width: 1,
        height: 1,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixel'
    )
    image.delete()
    return Array.from(pixels as Uint8Array)
  }

  test('redraws only the tiles of an image once its preview decodes', async () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0], 'page')
    const hash = 'red-square'
    graph.images.set(hash, encodedSquare(1, 0, 0))
    const node = graph.createNode('RECTANGLE', page.id, {
      x: 60,
      y: 40,
      width: 200,
      height: 160,
      fills: [
        {
          type: 'IMAGE',
          imageHash: hash,
          color: { r: 0, g: 0, b: 0, a: 1 },
          visible: true,
          opacity: 1
        }
      ]
    })
    graph.createNode('RECTANGLE', page.id, {
      x: 1000,
      y: 1000,
      width: 40,
      height: 40,
      fills: color(0, 0, 1)
    })
    const surface = expectDefined(ck.MakeSurface(320, 240), 'preview surface')
    const renderer = new SkiaRenderer(ck, surface)
    const controller = renderer.tiledScene
    renderer.tiledSceneEnabled = true
    renderer.pageId = page.id
    renderer.pageColor = { r: 1, g: 1, b: 1, a: 1 }
    renderer.viewportWidth = 320
    renderer.viewportHeight = 240
    renderer.dpr = 1
    renderer.zoom = 1
    renderer.navigationPhase = 'idle'
    renderer.viewportImageRendering = true
    renderer.imageMemoryGraph = graph
    let release: (() => void) | undefined
    const decoded = new Promise<void>((resolve) => {
      release = resolve
    })
    const edges: number[] = []
    const decoder: ImagePreviewDecoder = {
      decode: async (source, edge): Promise<ImagePreview> => {
        edges.push(edge)
        await decoded
        return { bytes: new Uint8Array(source), originalWidth: edge, originalHeight: edge }
      },
      destroy: mock()
    }
    renderer.imagePreviews.setDecoder(decoder)
    const ready: string[] = []
    renderer.onImagePreviewReady = (readyHash) => ready.push(readyHash)
    try {
      const canvas = surface.getCanvas()
      canvas.clear(ck.WHITE)
      let result = controller.renderFrame(renderer, canvas, graph, 1, 0)
      for (let frame = 0; frame < 10 && result.pending; frame++) {
        result = controller.renderFrame(renderer, canvas, graph, 1, 0)
      }
      expect(result.covered).toBe(true)
      // The preview is still decoding, so the image draws nothing yet.
      expect(centerPixel(renderer)).toEqual([255, 255, 255, 255])
      expect(renderer.imageFillUsers.get(hash)).toEqual(new Set([node.id]))

      expectDefined(release, 'release')()
      await decoded
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
      expect(ready).toEqual([hash])

      // The next frame invalidates only that node's tiles and renders them again.
      renderer.flushDecodedPreviews(graph)
      canvas.clear(ck.WHITE)
      result = controller.renderFrame(renderer, canvas, graph, 1, 0)
      for (let frame = 0; frame < 10 && result.pending; frame++) {
        result = controller.renderFrame(renderer, canvas, graph, 1, 0)
      }
      expect(result.covered).toBe(true)
      expect(centerPixel(renderer)).toEqual([255, 0, 0, 255])
      expect(edges).toEqual([256])

      // Four times closer, the tiles record the chunk again with a preview for their level.
      renderer.zoom = 4
      renderer.imageDetailScale = 4
      result = controller.renderFrame(renderer, canvas, graph, 1, 1)
      for (let frame = 0; frame < 10 && result.pending; frame++) {
        result = controller.renderFrame(renderer, canvas, graph, 1, 1)
      }
      expect(edges).toEqual([256, 1024])
    } finally {
      renderer.destroy()
    }
  })

  test('reports background work until the ring, page copy, pyramid, and backdrop are built', () => {
    const { graph, surface, renderer } = createGridScene()
    const controller = new TiledSceneController({ now: () => 0 })
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
    const { graph, surface, renderer } = createGridScene()
    const tileBytes = 512 * 512 * 4
    const sized = new TiledSceneController({ now: () => 0 })
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

  test('a layer added to one page child keeps the tiles of the others', () => {
    const { graph, surface, renderer, pageId } = createGridScene()
    const controller = new TiledSceneController({ now: () => 0 })
    try {
      let result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      for (let frame = 0; frame < 30 && (result.pending || result.backgroundPending); frame++) {
        result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
      expect(result.covered).toBe(true)
      const farTile = { pageId, level: 1, x: 2, y: 1 }
      expect(controller.isRendered(farTile)).toBe(true)

      // A new layer inside the first grid square: only its tile re-renders.
      const first = expectDefined(graph.getChildren(pageId)[0], 'first square')
      const added = graph.createNode('RECTANGLE', first.id, {
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        fills: color(1, 0, 0)
      })
      controller.invalidateStructure(added.id, first.id)
      expect(controller.hasPendingWork()).toBe(true)
      const changed = controller.renderFrame(renderer, surface.getCanvas(), graph, 2, 0)
      expect(controller.isRendered(farTile)).toBe(true)
      expect(changed.metrics.interruptibleCompleted + changed.metrics.mandatoryCompleted).toBe(1)
      expect(changed.covered).toBe(true)

      // Deleting it again touches only that tile too.
      graph.deleteNode(added.id)
      controller.invalidateStructure(added.id, first.id)
      const deleted = controller.renderFrame(renderer, surface.getCanvas(), graph, 3, 0)
      expect(controller.isRendered(farTile)).toBe(true)
      expect(deleted.metrics.interruptibleCompleted + deleted.metrics.mandatoryCompleted).toBe(1)
      expect(deleted.covered).toBe(true)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('a layer moved between frames leaves no ghost behind and appears where it went', () => {
    const { graph, surface, renderer, pageId } = createGridScene()
    const controller = new TiledSceneController({ now: () => 0 })
    try {
      // Two small frames, each one retained chunk, so a move must rebuild both chunks.
      const left = graph.createNode('FRAME', pageId, { x: 0, y: 400, width: 100, height: 100 })
      const right = graph.createNode('FRAME', pageId, { x: 200, y: 400, width: 100, height: 100 })
      const mover = graph.createNode('RECTANGLE', left.id, {
        x: 10,
        y: 10,
        width: 40,
        height: 40,
        fills: color(1, 0, 0)
      })
      let result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      for (let frame = 0; frame < 30 && (result.pending || result.backgroundPending); frame++) {
        result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
      expect(pixelAt(surface, 30, 430)).toEqual([255, 0, 0])
      expect(pixelAt(surface, 230, 430)).toEqual([255, 255, 255])

      // Moved keeping its own coordinates, so it draws at the same offset in the other frame.
      graph.insertChildAt(mover.id, right.id, 0)
      // The editor reports a move to its new parent and to its old one.
      controller.invalidateStructure(mover.id, right.id)
      controller.invalidateStructure(mover.id, left.id)
      let moved = controller.renderFrame(renderer, surface.getCanvas(), graph, 2, 0)
      for (let frame = 0; frame < 30 && moved.pending; frame++) {
        moved = controller.renderFrame(renderer, surface.getCanvas(), graph, 2, 0)
      }
      expect(moved.covered).toBe(true)
      expect(pixelAt(surface, 30, 430)).toEqual([255, 255, 255])
      expect(pixelAt(surface, 230, 430)).toEqual([255, 0, 0])
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('builds a pyramid of downsampled levels once the visible level settles', () => {
    const { graph, surface, renderer, pageId } = createGridScene()
    let step = 0
    let time = 0
    const controller = new TiledSceneController({ now: () => (time += step) })
    try {
      let result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      for (let frame = 0; frame < 12; frame++) {
        result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
      expect(result.covered).toBe(true)
      expect(result.pending).toBe(false)
      // The 1280×800 viewport at level 1 is five by four tiles; its halves exist down to one tile.
      expect(controller.isRendered({ pageId, level: 0.5, x: 0, y: 0 })).toBe(true)
      expect(controller.isRendered({ pageId, level: 0.25, x: 0, y: 0 })).toBe(true)
      expect(controller.isRendered({ pageId, level: 0.125, x: 0, y: 0 })).toBe(true)

      // Far out, the pyramid still stands in for everything that was rendered.
      step = 10
      renderer.zoom = 1 / 16
      renderer.navigationPhase = 'zoom'
      const zoomed = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 1)
      expect(zoomed.fallbackTileCount).toBeGreaterThan(0)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test("records a tile's chunk pictures across frames when they exceed the budget", () => {
    const { graph, surface, renderer, pageId } = createGridScene()
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
    const { graph, surface, renderer, pageId } = createGridScene()
    let time = 0
    const controller = new TiledSceneController({ now: () => (time += 10) })
    try {
      let result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      for (let frame = 0; frame < 60 && result.metrics.interruptibleCompleted === 0; frame++) {
        result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
      // The viewport spans world 0..1280 × 0..800: its centre lies in tile (1, 0).
      expect(result.metrics.interruptibleCompleted).toBe(1)
      expect(controller.isRendered({ pageId, level: 1, x: 1, y: 0 })).toBe(true)
      expect(controller.isRendered({ pageId, level: 1, x: 0, y: 0 })).toBe(false)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('a font arrival redraws only the text that waited for it', () => {
    const { graph, surface, renderer, pageId } = createGridScene()
    const text = graph.createNode('TEXT', pageId, { x: 20, y: 20, width: 100, height: 30 })
    const controller = renderer.tiledScene
    renderer.tiledSceneEnabled = true
    try {
      let result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      for (let frame = 0; frame < 30 && (result.pending || result.backgroundPending); frame++) {
        result = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
      expect(result.covered).toBe(true)
      expect(result.backgroundPending).toBe(false)
      renderer.invalidateNodesForFonts(graph, [pageId])
      expect(controller.hasPendingWork()).toBe(true)
      const redraw = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      expect(redraw.metrics.interruptibleCompleted).toBe(1)
      expect(controller.isRendered({ pageId, level: 1, x: 0, y: 0 })).toBe(true)
      void text
    } finally {
      renderer.destroy()
    }
  })
})
