import { expect, setDefaultTimeout, test } from 'bun:test'

import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import {
  coverFrame,
  createCanvasKitRasterCodec,
  headlessRenderCover,
  headlessRenderThumbnail,
  thumbnailFrame
} from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

setDefaultTimeout(60_000)

test('a thumbnail shows the page background between its layers', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  for (const x of [0, 90]) {
    graph.createNode('RECTANGLE', page.id, { x, y: 0, width: 10, height: 100 })
  }
  // Figma's dark-theme page background, #1E1E1E, which no renderer is set to.
  new FigmaAPI(graph).currentPage.backgrounds = [
    { type: 'SOLID', color: { r: 30 / 255, g: 30 / 255, b: 30 / 255 }, opacity: 1, visible: true }
  ]

  const png = expectDefined(await headlessRenderThumbnail(graph, page.id, 100, 100), 'thumbnail')
  const image = expectDefined(createCanvasKitRasterCodec(await getCanvasKit()).decode(png))
  const gap = (50 * image.width + 50) * 4

  expect([...image.data.subarray(gap, gap + 4)]).toEqual([30, 30, 30, 255])
})

test('a thumbnail loads the faces its text is set in before drawing it', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  // Inter Bold is bundled, so loading it needs no network, but a renderer loads only Regular.
  graph.createNode('TEXT', page.id, {
    width: 200,
    height: 60,
    text: 'Hello',
    fontSize: 48,
    fontWeight: 700
  })

  const png = expectDefined(await headlessRenderThumbnail(graph, page.id, 200, 60), 'thumbnail')
  const image = expectDefined(createCanvasKitRasterCodec(await getCanvasKit()).decode(png))
  const inked = image.data.filter((red, index) => index % 4 === 0 && red < 128).length

  expect(inked).toBeGreaterThan(0)
})

test('a letterboxed thumbnail fills its size with the whole content centred', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  graph.createNode('RECTANGLE', page.id, { x: 0, y: 0, width: 1000, height: 1000 })

  const contained = expectDefined(thumbnailFrame(graph, page.id, 160, 90), 'contained frame')
  expect([contained.width, contained.height]).toEqual([90, 90])

  const boxed = expectDefined(thumbnailFrame(graph, page.id, 160, 90, 'letterbox'), 'boxed frame')
  expect([boxed.width, boxed.height, boxed.scale]).toEqual([160, 90, 0.09])
  expect(boxed.bounds.minY).toBe(0)
  expect(boxed.bounds.maxY).toBe(1000)
  expect(boxed.bounds.minX).toBeCloseTo(-388.89, 2)
  expect(boxed.bounds.maxX).toBeCloseTo(1388.89, 2)
})

test('a thumbnail of chosen layers leaves out the layers over them', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const solid = (r: number, g: number, b: number) => [
    { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
  ]
  const cover = graph.createNode('FRAME', page.id, {
    width: 100,
    height: 100,
    fills: solid(0, 0, 1)
  })
  graph.createNode('RECTANGLE', page.id, {
    x: 25,
    y: 25,
    width: 50,
    height: 50,
    fills: solid(1, 0, 0)
  })
  const codec = createCanvasKitRasterCodec(await getCanvasKit())
  const centre = async (nodeIds?: readonly string[]) => {
    const png = expectDefined(
      await headlessRenderThumbnail(graph, page.id, 100, 100, nodeIds),
      'thumbnail'
    )
    const image = expectDefined(codec.decode(png))
    const offset = (50 * image.width + 50) * 4
    return [...image.data.subarray(offset, offset + 4)]
  }

  expect(await centre([cover.id])).toEqual([0, 0, 255, 255])
  expect(await centre()).toEqual([255, 0, 0, 255])
})

test('a cover of a tall page shows its top at the page’s width, a chosen frame whole', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const tall = graph.createNode('FRAME', page.id, { x: 0, y: 0, width: 400, height: 2000 })

  const top = expectDefined(coverFrame(graph, page.id, 1920, 960), 'top of the page')
  expect([top.width, top.height, top.scale]).toEqual([1920, 960, 1920 / 400])
  expect(top.bounds).toEqual({ minX: 0, minY: 0, maxX: 400, maxY: 200 })

  const chosen = expectDefined(coverFrame(graph, page.id, 1920, 960, [tall.id]), 'chosen frame')
  expect([chosen.width, chosen.height]).toEqual([1920, 960])
  expect(chosen.bounds.maxY - chosen.bounds.minY).toBeCloseTo(2000)
})

test('a drawn cover shows the top of a tall page, or a chosen frame alone', async () => {
  const solid = (r: number, g: number, b: number) => [
    { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
  ]
  const codec = createCanvasKitRasterCodec(await getCanvasKit())
  const pixels = async (graph: SceneGraph, pageId: string, nodeIds?: readonly string[]) => {
    const png = expectDefined(await headlessRenderCover(graph, pageId, 200, 100, nodeIds), 'cover')
    const image = expectDefined(codec.decode(png))
    expect([image.width, image.height]).toEqual([200, 100])
    return (x: number, y: number) => [
      ...image.data.subarray((y * 200 + x) * 4, (y * 200 + x) * 4 + 3)
    ]
  }

  // A tall page: its top 2:1 is the red first screen, and the blue below is left out.
  const tall = new SceneGraph()
  const tallPage = tall.getPages()[0]
  tall.createNode('RECTANGLE', tallPage.id, { width: 400, height: 200, fills: solid(1, 0, 0) })
  tall.createNode('RECTANGLE', tallPage.id, {
    y: 200,
    width: 400,
    height: 1800,
    fills: solid(0, 0, 1)
  })
  const top = await pixels(tall, tallPage.id)
  expect(top(100, 5)).toEqual([255, 0, 0])
  expect(top(100, 95)).toEqual([255, 0, 0])

  // A chosen frame fills the cover by itself, wherever it is and whatever lies over it.
  const board = new SceneGraph()
  const boardPage = board.getPages()[0]
  const chosen = board.createNode('FRAME', boardPage.id, {
    x: 600,
    y: 900,
    width: 200,
    height: 100,
    fills: solid(0, 1, 0)
  })
  board.createNode('RECTANGLE', boardPage.id, { width: 2000, height: 2000, fills: solid(1, 0, 0) })
  expect((await pixels(board, boardPage.id, [chosen.id]))(100, 50)).toEqual([0, 255, 0])
})
