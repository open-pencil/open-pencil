import { beforeAll, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import {
  deleteRecordedRenderChunks,
  recordRenderChunk,
  RenderChunkIndex
} from '#core/canvas/renderer/chunks'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

function renderPixels(renderer: SkiaRenderer, graph: SceneGraph, pageId: string, chunked: boolean) {
  const canvas = renderer.surface.getCanvas()
  canvas.clear(ck.WHITE)
  if (chunked) {
    const { index } = RenderChunkIndex.build(graph, pageId)
    const chunks = index.search({ minX: 0, minY: 0, maxX: 320, maxY: 240 })
    const recorded = chunks.map((chunk) => recordRenderChunk(renderer, graph, chunk))
    for (const chunk of chunks) {
      const picture = recorded.find((entry) => entry.chunk.id === chunk.id)?.picture
      if (picture) canvas.drawPicture(picture)
    }
    deleteRecordedRenderChunks(recorded)
    index.dispose()
  } else {
    renderer.renderSceneToCanvas(canvas, graph, pageId)
  }
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  const pixels = image.readPixels(0, 0, {
    width: 320,
    height: 240,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB
  })
  image.delete()
  return expectDefined(pixels, 'rendered chunk pixels')
}

function differenceRatio(a: Uint8Array, b: Uint8Array, tolerance = 8) {
  let different = 0
  for (let index = 0; index < a.length; index++) {
    if (Math.abs(a[index] - b[index]) > tolerance) different++
  }
  return different / a.length
}

function renderPair(graph: SceneGraph, pageId: string) {
  const directSurface = expectDefined(ck.MakeSurface(320, 240), 'direct surface')
  const chunkSurface = expectDefined(ck.MakeSurface(320, 240), 'chunk surface')
  const direct = new SkiaRenderer(ck, directSurface)
  const chunked = new SkiaRenderer(ck, chunkSurface)
  try {
    const expected = renderPixels(direct, graph, pageId, false)
    const actual = renderPixels(chunked, graph, pageId, true)
    return differenceRatio(expected, actual)
  } finally {
    direct.destroy()
    chunked.destroy()
  }
}

function color(r: number, g: number, b: number) {
  return [{ type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }]
}

describe('recorded render chunks', () => {
  test('match direct rendering for split nested transforms and rounded clips', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0], 'page')
    const clip = graph.createNode('FRAME', page.id, {
      x: 60,
      y: 40,
      width: 180,
      height: 140,
      rotation: 8,
      cornerRadius: 18,
      clipsContent: true,
      fills: color(0.9, 0.9, 0.95)
    })
    const frame = graph.createNode('FRAME', clip.id, { x: 20, y: 15, width: 300, height: 100 })
    for (let index = 0; index < 40; index++) {
      graph.createNode('RECTANGLE', frame.id, {
        x: index * 12,
        y: index % 2 === 0 ? 10 : 45,
        width: 18,
        height: 18,
        fills: color(0.1, 0.4 + (index % 3) * 0.15, 0.8)
      })
    }

    expect(renderPair(graph, page.id)).toBeLessThan(0.01)
  })

  test('records atomic chunks as indivisible destination-dependent command pictures', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0], 'page')
    const group = graph.createNode('FRAME', page.id, { opacity: 0.5 })
    for (let index = 0; index < 40; index++) {
      graph.createNode('RECTANGLE', group.id, { width: 10, height: 10 })
    }
    const surface = expectDefined(ck.MakeSurface(320, 240), 'atomic surface')
    const renderer = new SkiaRenderer(ck, surface)
    try {
      const { index } = RenderChunkIndex.build(graph, page.id)
      const chunk = index.getChunksForNode(group.id)[0]
      if (!chunk) throw new Error('Expected atomic chunk')
      const recorded = recordRenderChunk(renderer, graph, chunk)
      expect(recorded.picture).toBeDefined()
      recorded.picture.delete()
      index.dispose()
    } finally {
      renderer.destroy()
    }
  })

  test('match direct rendering for atomic opacity and blend isolation', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0], 'page')
    graph.createNode('RECTANGLE', page.id, {
      x: 20,
      y: 20,
      width: 240,
      height: 180,
      fills: color(0.9, 0.2, 0.2)
    })
    const group = graph.createNode('FRAME', page.id, {
      x: 40,
      y: 30,
      width: 220,
      height: 160,
      opacity: 0.6,
      blendMode: 'MULTIPLY',
      fills: []
    })
    for (let index = 0; index < 40; index++) {
      graph.createNode('ELLIPSE', group.id, {
        x: (index % 10) * 18,
        y: Math.floor(index / 10) * 28,
        width: 28,
        height: 28,
        fills: color(0.2, 0.7, 0.9)
      })
    }

    expect(renderPair(graph, page.id)).toBeLessThan(0.01)
  })
})
