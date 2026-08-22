import { beforeAll, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import { RenderChunkIndex, RenderChunkPictureCache } from '#core/canvas/renderer/chunks'
import {
  deleteRenderedTile,
  renderTile,
  TiledSceneController,
  TILE_DEVICE_SIZE,
  TileSurfacePool,
  tileKeysForWorldBounds,
  tileWorldBounds
} from '#core/canvas/renderer/tiles'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

function color(r: number, g: number, b: number) {
  return [{ type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }]
}

function pixels(image: ReturnType<typeof ck.MakeImageFromEncoded>, width: number, height: number) {
  if (!image) throw new Error('Expected image')
  return expectDefined(
    image.readPixels(0, 0, {
      width,
      height,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    }),
    'tile pixels'
  )
}

function differenceRatio(a: Uint8Array, b: Uint8Array, tolerance = 8) {
  let different = 0
  for (let index = 0; index < a.length; index++) {
    if (Math.abs(a[index] - b[index]) > tolerance) different++
  }
  return different / a.length
}

function squareCommandsBlob(): Uint8Array {
  const blob = new Uint8Array(1 + 4 * 9 + 1)
  const view = new DataView(blob.buffer)
  let offset = 0
  for (const [command, x, y] of [
    [1, 0, 0],
    [2, 1, 0],
    [2, 1, 1],
    [2, 0, 1]
  ] as const) {
    blob[offset] = command
    view.setFloat32(offset + 1, x, true)
    view.setFloat32(offset + 5, y, true)
    offset += 9
  }
  blob[offset] = 0
  return blob
}

function testImageBytes(): Uint8Array {
  const surface = expectDefined(ck.MakeSurface(8, 8), 'test image surface')
  const canvas = surface.getCanvas()
  canvas.clear(ck.Color4f(0.95, 0.75, 0.1, 1))
  const paint = new ck.Paint()
  paint.setColor(ck.Color4f(0.1, 0.3, 0.95, 1))
  canvas.drawRect(ck.LTRBRect(0, 0, 4, 8), paint)
  surface.flush()
  const image = surface.makeImageSnapshot()
  const bytes = expectDefined(image.encodeToBytes(ck.ImageFormat.PNG, 100), 'test image PNG')
  image.delete()
  paint.delete()
  surface.delete()
  return bytes
}

function createParityGraph() {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const clip = graph.createNode('FRAME', page.id, {
    x: 40,
    y: 30,
    width: 260,
    height: 180,
    clipsContent: true,
    cornerRadius: 20,
    fills: color(0.95, 0.95, 0.98)
  })
  const frame = graph.createNode('FRAME', clip.id, { width: 360, height: 160, fills: [] })
  for (let index = 0; index < 48; index++) {
    graph.createNode(index % 2 === 0 ? 'RECTANGLE' : 'ELLIPSE', frame.id, {
      x: (index % 12) * 28,
      y: Math.floor(index / 12) * 36,
      width: 32,
      height: 32,
      fills: color((index % 3) * 0.35, 0.3, 0.85 - (index % 2) * 0.3)
    })
  }
  const translucent = graph.createNode('FRAME', page.id, {
    x: 210,
    y: 55,
    width: 100,
    height: 120,
    opacity: 0.55,
    blendMode: 'MULTIPLY',
    fills: [],
    effects: [
      {
        type: 'FOREGROUND_BLUR',
        visible: true,
        radius: 12,
        spread: 0,
        offset: { x: 0, y: 0 },
        color: { r: 0, g: 0, b: 0, a: 1 }
      }
    ]
  })
  graph.createNode('RECTANGLE', translucent.id, {
    x: 5,
    y: 5,
    width: 80,
    height: 90,
    fills: color(0.9, 0.2, 0.4),
    effects: [
      {
        type: 'DROP_SHADOW',
        visible: true,
        color: { r: 0.1, g: 0.1, b: 0.2, a: 0.7 },
        offset: { x: 18, y: 6 },
        radius: 16,
        spread: 3
      }
    ]
  })
  const masked = graph.createNode('FRAME', page.id, {
    x: 105,
    y: 150,
    width: 130,
    height: 80,
    fills: []
  })
  graph.createNode('ELLIPSE', masked.id, {
    x: 0,
    y: 0,
    width: 90,
    height: 70,
    isMask: true,
    fills: color(0, 0, 0)
  })
  graph.createNode('RECTANGLE', masked.id, {
    x: -15,
    y: -5,
    width: 150,
    height: 90,
    fills: color(0.1, 0.8, 0.35)
  })
  const imageHash = 'tile-parity-image'
  graph.images.set(imageHash, testImageBytes())
  graph.createNode('RECTANGLE', page.id, {
    x: 238,
    y: 176,
    width: 68,
    height: 52,
    rotation: -7,
    fills: [
      {
        type: 'IMAGE',
        imageHash,
        imageScaleMode: 'FILL',
        opacity: 1,
        visible: true
      }
    ]
  })
  graph.createNode('TEXT', page.id, {
    x: 245,
    y: 15,
    width: 64,
    height: 34,
    rotation: 9,
    text: 'tile',
    fontFamily: '__MissingFont__',
    fontSize: 22,
    fills: color(0.15, 0.1, 0.75),
    derivedTextGlyphs: [
      { commandsBlob: squareCommandsBlob(), x: 0, y: 22, fontSize: 18 },
      { commandsBlob: squareCommandsBlob(), x: 20, y: 22, fontSize: 18 },
      { commandsBlob: squareCommandsBlob(), x: 40, y: 22, fontSize: 18 }
    ]
  })
  return { graph, page }
}

describe('tile rendering', () => {
  test('refreshes only tiles intersecting an updated isolated chunk', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0], 'page')
    const changed = graph.createNode('RECTANGLE', page.id, {
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      fills: color(1, 0, 0)
    })
    graph.createNode('RECTANGLE', page.id, {
      x: 540,
      y: 20,
      width: 40,
      height: 40,
      fills: color(0, 0, 1)
    })
    const surface = expectDefined(ck.MakeSurface(640, 240), 'selective invalidation surface')
    const renderer = new SkiaRenderer(ck, surface)
    const controller = new TiledSceneController()
    renderer.pageId = page.id
    renderer.pageColor = { r: 1, g: 1, b: 1, a: 1 }
    renderer.viewportWidth = 640
    renderer.viewportHeight = 240
    renderer.dpr = 1
    renderer.zoom = 1
    renderer.navigationPhase = 'idle'
    try {
      let initial = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      for (let frame = 0; frame < 10 && initial.pending; frame++) {
        initial = controller.renderFrame(renderer, surface.getCanvas(), graph, 1, 0)
      }
      expect(initial.covered).toBe(true)

      controller.invalidateNode(changed.id)
      graph.updateNode(changed.id, { x: 30, fills: color(0, 1, 0) })
      const refreshed = controller.renderFrame(renderer, surface.getCanvas(), graph, 2, 0)
      expect(refreshed.metrics.interruptibleCompleted).toBe(1)
      expect(refreshed.covered).toBe(true)
    } finally {
      controller.destroy()
      renderer.destroy()
    }
  })

  test('live controller progressively replaces fallback pixels without changing the scene', () => {
    const { graph, page } = createParityGraph()
    const directSurface = expectDefined(ck.MakeSurface(320, 240), 'direct controller surface')
    const tiledSurface = expectDefined(ck.MakeSurface(320, 240), 'tiled controller surface')
    const direct = new SkiaRenderer(ck, directSurface)
    const tiled = new SkiaRenderer(ck, tiledSurface)
    const controller = new TiledSceneController()
    const pageColor = { r: 1, g: 1, b: 1, a: 1 }
    for (const renderer of [direct, tiled]) {
      renderer.pageId = page.id
      renderer.pageColor = pageColor
      renderer.viewportWidth = 320
      renderer.viewportHeight = 240
      renderer.dpr = 1
      renderer.zoom = 1
      renderer.navigationPhase = 'idle'
      renderer.nodeFontReadiness = () => 'exhausted'
    }

    try {
      direct.surface.getCanvas().clear(ck.WHITE)
      direct.renderSceneToCanvas(direct.surface.getCanvas(), graph, page.id)
      direct.surface.flush()
      const directImage = direct.surface.makeImageSnapshot()

      let result = { covered: false, pending: true }
      for (let frame = 0; frame < 20 && result.pending; frame++) {
        const canvas = tiled.surface.getCanvas()
        canvas.clear(ck.WHITE)
        tiled.renderSceneToCanvas(canvas, graph, page.id)
        result = controller.renderFrame(tiled, canvas, graph, 1, 0)
        tiled.surface.flush()
      }
      expect(result.covered).toBe(true)
      expect(result.pending).toBe(false)

      const tiledImage = tiled.surface.makeImageSnapshot()
      expect(
        differenceRatio(pixels(directImage, 320, 240), pixels(tiledImage, 320, 240))
      ).toBeLessThan(0.01)
      directImage.delete()
      tiledImage.delete()
    } finally {
      controller.destroy()
      direct.destroy()
      tiled.destroy()
    }
  })

  test('composes multiple queried tiles to match direct scene rendering', () => {
    const { graph, page } = createParityGraph()

    const directSurface = expectDefined(ck.MakeSurface(320, 240), 'direct surface')
    const tiledSurface = expectDefined(ck.MakeSurface(320, 240), 'tiled surface')
    const tileFactorySurface = expectDefined(ck.MakeSurface(320, 240), 'tile factory surface')
    const direct = new SkiaRenderer(ck, directSurface)
    const tiled = new SkiaRenderer(ck, tiledSurface)
    const tileFactory = new SkiaRenderer(ck, tileFactorySurface)
    direct.pageColor = { r: 1, g: 1, b: 1, a: 1 }
    tiled.pageColor = { r: 1, g: 1, b: 1, a: 1 }
    tileFactory.pageColor = { r: 1, g: 1, b: 1, a: 1 }
    direct.nodeFontReadiness = () => 'exhausted'
    tiled.nodeFontReadiness = () => 'exhausted'
    tileFactory.nodeFontReadiness = () => 'exhausted'
    const { index } = RenderChunkIndex.build(graph, page.id)
    const level = 1
    const keys = tileKeysForWorldBounds(page.id, level, {
      minX: 0,
      minY: 0,
      maxX: 320,
      maxY: 240
    })
    const pictureCache = new RenderChunkPictureCache()
    const surfacePool = new TileSurfacePool()
    try {
      direct.surface.getCanvas().clear(ck.WHITE)
      direct.renderSceneToCanvas(direct.surface.getCanvas(), graph, page.id)
      direct.surface.flush()
      const directImage = direct.surface.makeImageSnapshot()

      const tiledCanvas = tiled.surface.getCanvas()
      tiledCanvas.clear(ck.WHITE)
      const rendered = keys.map((key) =>
        renderTile(tileFactory, graph, index, key, pictureCache, surfacePool)
      )
      const tilePaint = new ck.Paint()
      tilePaint.setBlendMode(ck.BlendMode.Src)
      for (const tile of rendered) {
        const bounds = tileWorldBounds(tile.key)
        tiledCanvas.drawImageRectOptions(
          tile.image,
          ck.LTRBRect(0, 0, TILE_DEVICE_SIZE, TILE_DEVICE_SIZE),
          ck.LTRBRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY),
          ck.FilterMode.Nearest,
          ck.MipmapMode.None,
          tilePaint
        )
      }
      tilePaint.delete()
      tiled.surface.flush()
      const tiledImage = tiled.surface.makeImageSnapshot()

      expect(
        differenceRatio(pixels(directImage, 320, 240), pixels(tiledImage, 320, 240))
      ).toBeLessThan(0.01)
      expect(rendered.every((tile) => tile.chunkCount < index.size())).toBe(true)
      expect(rendered.every((tile) => tile.image.width() === TILE_DEVICE_SIZE)).toBe(true)

      directImage.delete()
      tiledImage.delete()
      for (const tile of rendered) deleteRenderedTile(tile)
    } finally {
      surfacePool.clear()
      pictureCache.clear()
      index.dispose()
      direct.destroy()
      tiled.destroy()
      tileFactory.destroy()
    }
  })
})
