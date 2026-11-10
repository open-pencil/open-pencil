import { beforeAll, describe, expect, mock, test } from 'bun:test'

import type { Image as CKImage } from '@open-pencil/canvaskit'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SkiaRenderer } from '#core/canvas'
import { RenderChunkIndex, RenderChunkPictureCache } from '#core/canvas/renderer/chunks'
import {
  deleteRenderedTile,
  renderTile,
  TileImageCache,
  TileSurfacePool,
  tileKeysForWorldBounds,
  tileWorldBounds
} from '#core/canvas/renderer/tiles'
import { applyInvalidations } from '#core/canvas/renderer/tiles/structure'

import { asDouble, expectRgbaPixels } from '#core-tests/canvas/helpers'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

function color(r: number, g: number, b: number) {
  return [{ type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }]
}

function pixels(image: ReturnType<typeof ck.MakeImageFromEncoded>, width: number, height: number) {
  if (!image) throw new Error('Expected image')
  return expectRgbaPixels(
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

/** The largest difference between two images in any channel. */
function largestDifference(a: Uint8Array, b: Uint8Array) {
  let largest = 0
  for (let index = 0; index < a.length; index++) {
    largest = Math.max(largest, Math.abs(a[index] - b[index]))
  }
  return largest
}
describe('tiles under glass', () => {
  /** Black and white stripes 16 units wide across 1024 × 256, and glass over the tile edge at 512. */
  function stripesUnderGlass() {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0], 'page')
    const stripes = Array.from({ length: 64 }, (_, index) =>
      graph.createNode('RECTANGLE', page.id, {
        x: index * 16,
        y: 0,
        width: 16,
        height: 256,
        fills: color(index % 2, index % 2, index % 2)
      })
    )
    const glass = graph.createNode('RECTANGLE', page.id, {
      x: 440,
      y: 48,
      width: 160,
      height: 160,
      cornerRadius: 24,
      effects: [
        {
          type: 'GLASS',
          radius: 0,
          spread: 0,
          offset: { x: 0, y: 0 },
          color: { r: 0, g: 0, b: 0, a: 1 },
          visible: true,
          blendMode: 'NORMAL',
          showShadowBehindNode: false,
          glass: { refraction: 1, depth: 40, lightAngle: -45, lightIntensity: 0.6, dispersion: 0 }
        }
      ]
    })
    return { graph, page, stripes, glass }
  }

  test('glass across a tile edge bends what lies in the next tile, as drawn directly', () => {
    const { graph, page } = stripesUnderGlass()
    const direct = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1024, 256), 'direct'))
    const tiled = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1024, 256), 'tiled'))
    const { index } = RenderChunkIndex.build(graph, page.id)
    const pictureCache = new RenderChunkPictureCache()
    const surfacePool = new TileSurfacePool()
    try {
      for (const renderer of [direct, tiled]) renderer.pageColor = { r: 1, g: 1, b: 1, a: 1 }
      direct.surface.getCanvas().clear(ck.WHITE)
      direct.renderSceneToCanvas(direct.surface.getCanvas(), graph, page.id)
      direct.surface.flush()
      const directImage = direct.surface.makeImageSnapshot()

      const canvas = tiled.surface.getCanvas()
      const keys = tileKeysForWorldBounds(page.id, 1, { minX: 0, minY: 0, maxX: 1024, maxY: 256 })
      for (const key of keys) {
        const tile = expectDefined(
          renderTile(tiled, graph, index, key, pictureCache, surfacePool),
          'tile'
        )
        const bounds = tileWorldBounds(key)
        canvas.drawImage(expectDefined(tile.image, 'tile image'), bounds.minX, bounds.minY)
        deleteRenderedTile(tile)
      }
      tiled.surface.flush()
      const tiledImage = tiled.surface.makeImageSnapshot()

      expect(
        largestDifference(pixels(directImage, 1024, 256), pixels(tiledImage, 1024, 256))
      ).toBeLessThanOrEqual(2)
      directImage.delete()
      tiledImage.delete()
    } finally {
      surfacePool.clear()
      pictureCache.clear()
      index.dispose()
      direct.destroy()
      tiled.destroy()
    }
  })

  test('a change within the reach of glass redraws the tiles the glass draws in', () => {
    const { graph, page, stripes } = stripesUnderGlass()
    const { index } = RenderChunkIndex.build(graph, page.id)
    const tileCache = new TileImageCache()
    const image = asDouble<CKImage>({ width: () => 512, height: () => 512, delete: mock() })
    for (const x of [0, 1]) {
      tileCache.install(
        {
          key: { pageId: page.id, level: 1, x, y: 0 },
          image,
          chunkCount: 1,
          estimatedCost: 1,
          renderMs: 1,
          allocationMs: 0,
          drawMs: 1,
          flushMs: 0,
          snapshotMs: 0
        },
        1
      )
    }
    // The stripe at 624 lies in the right tile only, 24 units past the glass's right edge.
    const stripe = expectDefined(stripes[39], 'stripe')
    const previousBounds = index.getChunksDependingOnNode(stripe.id).map((chunk) => ({ ...chunk }))
    graph.updateNode(stripe.id, { fills: color(1, 0, 0) })
    applyInvalidations(
      { index, pageId: page.id, pictureCache: new RenderChunkPictureCache(), tileCache },
      graph,
      [{ nodeId: stripe.id, previousBounds }],
      2
    )
    expect(tileCache.getIfPresent({ pageId: page.id, level: 1, x: 1, y: 0 })).toBeNull()
    expect(tileCache.getIfPresent({ pageId: page.id, level: 1, x: 0, y: 0 })).toBeNull()
    index.dispose()
  })
})
