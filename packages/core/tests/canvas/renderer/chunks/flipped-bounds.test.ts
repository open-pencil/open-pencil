import { afterAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas'
import { recordRenderChunk, RenderChunkIndex } from '#core/canvas/renderer/chunks'
import { initCanvasKit } from '#core/io/formats/raster'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'

const WIDTH = 240
const HEIGHT = 160

const ck = await initCanvasKit()
const direct = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(WIDTH, HEIGHT), 'direct surface'))
const chunked = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(WIDTH, HEIGHT), 'chunk surface'))

afterAll(() => {
  direct.destroy()
  chunked.destroy()
})

function solid(r: number, g: number, b: number) {
  return [{ type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }]
}

function emptyPage() {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  return { graph, pageId: page.id }
}

function worldBox(graph: SceneGraph, node: SceneNode) {
  const { x, y, width, height } = getAxisAlignedWorldBounds(node, graph)
  return { minX: x, minY: y, maxX: x + width, maxY: y + height }
}

function chunkBox(graph: SceneGraph, pageId: string, nodeId: string) {
  const { index } = RenderChunkIndex.build(graph, pageId)
  try {
    const chunk = expectDefined(index.getChunksForNode(nodeId)[0], `chunk of ${nodeId}`)
    return { minX: chunk.minX, minY: chunk.minY, maxX: chunk.maxX, maxY: chunk.maxY }
  } finally {
    index.dispose()
  }
}

function expectBoxClose(
  actual: ReturnType<typeof worldBox>,
  expected: ReturnType<typeof worldBox>
) {
  expect(actual.minX).toBeCloseTo(expected.minX, 6)
  expect(actual.minY).toBeCloseTo(expected.minY, 6)
  expect(actual.maxX).toBeCloseTo(expected.maxX, 6)
  expect(actual.maxY).toBeCloseTo(expected.maxY, 6)
}

function readPixels(renderer: SkiaRenderer): Uint8Array {
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    const pixels = image.readPixels(0, 0, {
      width: WIDTH,
      height: HEIGHT,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    if (!(pixels instanceof Uint8Array)) {
      throw new TypeError('expected 8-bit RGBA pixels')
    }
    return pixels
  } finally {
    image.delete()
  }
}

function renderDirect(graph: SceneGraph, pageId: string): Uint8Array {
  const canvas = direct.surface.getCanvas()
  canvas.clear(ck.WHITE)
  direct.renderSceneToCanvas(canvas, graph, pageId)
  return readPixels(direct)
}

function renderChunked(graph: SceneGraph, pageId: string): Uint8Array {
  const canvas = chunked.surface.getCanvas()
  canvas.clear(ck.WHITE)
  const { index } = RenderChunkIndex.build(graph, pageId)
  try {
    for (const chunk of index.search({ minX: 0, minY: 0, maxX: WIDTH, maxY: HEIGHT })) {
      const { picture } = recordRenderChunk(chunked, graph, chunk)
      canvas.drawPicture(picture)
      picture.delete()
    }
  } finally {
    index.dispose()
  }
  return readPixels(chunked)
}

function differentPixels(a: Uint8Array, b: Uint8Array): number {
  let different = 0
  for (let offset = 0; offset < a.length; offset += 4) {
    const channels = [0, 1, 2, 3].map((channel) => Math.abs(a[offset + channel] - b[offset + channel]))
    if (Math.max(...channels) > 8) {
      different++
    }
  }
  return different
}

function pixelAt(pixels: Uint8Array, x: number, y: number): number[] {
  const offset = (Math.floor(y) * WIDTH + Math.floor(x)) * 4
  return [pixels[offset], pixels[offset + 1], pixels[offset + 2]]
}

const flips = [
  { name: 'flipX', flipX: true, flipY: false },
  { name: 'flipY', flipX: false, flipY: true },
  { name: 'both flips', flipX: true, flipY: true }
]

describe('render chunk bounds of flipped nodes', () => {
  for (const { name, flipX, flipY } of flips) {
    test(`a ${name} leaf gets its drawn box`, () => {
      const { graph, pageId } = emptyPage()
      const leaf = graph.createNode('RECTANGLE', pageId, {
        x: 40,
        y: 30,
        width: 60,
        height: 20,
        flipX,
        flipY,
        fills: solid(0.2, 0.4, 0.8)
      })

      expectBoxClose(chunkBox(graph, pageId, leaf.id), worldBox(graph, leaf))
    })

    test(`a ${name} parent keeps a small child at its edge drawn`, () => {
      const { graph, pageId } = emptyPage()
      const parent = graph.createNode('FRAME', pageId, {
        x: 40,
        y: 30,
        width: 120,
        height: 80,
        flipX,
        flipY,
        fills: []
      })
      const child = graph.createNode('RECTANGLE', parent.id, {
        x: 2,
        y: 2,
        width: 8,
        height: 8,
        fills: solid(0.9, 0.1, 0.1)
      })

      const bounds = chunkBox(graph, pageId, parent.id)
      const childBox = worldBox(graph, child)
      expect(bounds.minX).toBeLessThanOrEqual(childBox.minX)
      expect(bounds.minY).toBeLessThanOrEqual(childBox.minY)
      expect(bounds.maxX).toBeGreaterThanOrEqual(childBox.maxX)
      expect(bounds.maxY).toBeGreaterThanOrEqual(childBox.maxY)

      const pixels = renderChunked(graph, pageId)
      const center = [(childBox.minX + childBox.maxX) / 2, (childBox.minY + childBox.maxY) / 2]
      expect(pixelAt(pixels, center[0], center[1])).toEqual(
        pixelAt(renderDirect(graph, pageId), center[0], center[1])
      )
      expect(differentPixels(pixels, renderDirect(graph, pageId))).toBe(0)
    })
  }

  test('a rotated and flipped leaf gets its drawn box', () => {
    const { graph, pageId } = emptyPage()
    const leaf = graph.createNode('RECTANGLE', pageId, {
      x: 60,
      y: 40,
      width: 80,
      height: 24,
      rotation: 30,
      flipX: true,
      fills: solid(0.2, 0.6, 0.3)
    })

    expectBoxClose(chunkBox(graph, pageId, leaf.id), worldBox(graph, leaf))
  })

  test('a rotated and flipped parent draws its children through chunks as directly', () => {
    const { graph, pageId } = emptyPage()
    const parent = graph.createNode('FRAME', pageId, {
      x: 60,
      y: 30,
      width: 110,
      height: 70,
      rotation: 20,
      flipX: true,
      fills: []
    })
    const children = [
      { x: 1, y: 1 },
      { x: 100, y: 1 },
      { x: 1, y: 60 },
      { x: 100, y: 60 }
    ].map((position) =>
      graph.createNode('RECTANGLE', parent.id, {
        ...position,
        width: 9,
        height: 9,
        fills: solid(0.1, 0.1, 0.9)
      })
    )

    const bounds = chunkBox(graph, pageId, parent.id)
    for (const child of children) {
      const childBox = worldBox(graph, child)
      expect(bounds.minX).toBeLessThanOrEqual(childBox.minX + 1e-6)
      expect(bounds.minY).toBeLessThanOrEqual(childBox.minY + 1e-6)
      expect(bounds.maxX).toBeGreaterThanOrEqual(childBox.maxX - 1e-6)
      expect(bounds.maxY).toBeGreaterThanOrEqual(childBox.maxY - 1e-6)
    }
    expect(differentPixels(renderChunked(graph, pageId), renderDirect(graph, pageId))).toBe(0)
  })

  test('a flipped parent that does not clip holds a child past its edge', () => {
    const { graph, pageId } = emptyPage()
    const parent = graph.createNode('FRAME', pageId, {
      x: 40,
      y: 30,
      width: 120,
      height: 80,
      flipX: true,
      clipsContent: false,
      fills: solid(0.95, 0.9, 0.8)
    })
    const child = graph.createNode('RECTANGLE', parent.id, {
      x: 110,
      y: 30,
      width: 30,
      height: 10,
      fills: solid(0.9, 0.1, 0.1)
    })

    const childBox = worldBox(graph, child)
    const parentBox = worldBox(graph, parent)
    expect(childBox.minX).toBeLessThan(parentBox.minX)
    const { index } = RenderChunkIndex.build(graph, pageId)
    try {
      const parentChunk = expectDefined(index.getChunksForNode(parent.id)[0], 'parent chunk')
      const pastTheEdge = { ...childBox, maxX: parentBox.minX - 1 }
      expect(index.search(pastTheEdge)).toContain(parentChunk)
    } finally {
      index.dispose()
    }
    const pixels = renderChunked(graph, pageId)
    const pastTheEdgeCenter = [
      (childBox.minX + parentBox.minX) / 2,
      (childBox.minY + childBox.maxY) / 2
    ]
    const [red, green] = pixelAt(pixels, pastTheEdgeCenter[0], pastTheEdgeCenter[1])
    expect(red).toBeGreaterThan(200)
    expect(green).toBeLessThan(80)
    expect(differentPixels(pixels, renderDirect(graph, pageId))).toBe(0)
  })

  test('a flipped clipping frame bounds its clipped children by its own drawn box', () => {
    const { graph, pageId } = emptyPage()
    const frame = graph.createNode('FRAME', pageId, {
      x: 40,
      y: 30,
      width: 100,
      height: 60,
      flipX: true,
      clipsContent: true,
      fills: solid(0.95, 0.9, 0.8)
    })
    graph.createNode('RECTANGLE', frame.id, {
      x: 90,
      y: 10,
      width: 40,
      height: 10,
      fills: solid(0.9, 0.1, 0.1)
    })

    expectBoxClose(chunkBox(graph, pageId, frame.id), worldBox(graph, frame))
    expect(differentPixels(renderChunked(graph, pageId), renderDirect(graph, pageId))).toBe(0)
  })
})
