import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Effect } from '@open-pencil/scene-graph'

const ck = await initCanvasKit()

function solidFill(r: number, g: number, b: number) {
  return [{ type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }]
}

function exportedRgba(graph: SceneGraph, pageId: string, nodeId: string) {
  const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, pageId, [nodeId], { scale: 1, format: 'PNG' }),
      'png'
    )
    const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
    const width = image.width()
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
        width,
        height: image.height()
      }),
      'pixels'
    )
    image.delete()
    return (x: number, y: number) => {
      const offset = (y * width + x) * 4
      return Array.from(pixels.subarray(offset, offset + 4))
    }
  } finally {
    renderer.destroy()
  }
}

function frameOverNeighbour(
  frameBlend: 'PASS_THROUGH' | 'MULTIPLY',
  childBlend: 'NORMAL' | 'MULTIPLY',
  frameEffects: Effect[] = []
) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  graph.createNode('RECTANGLE', page.id, {
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    fills: solidFill(0, 0, 1)
  })
  const frame = graph.createNode('FRAME', page.id, {
    x: 20,
    y: 20,
    width: 40,
    height: 40,
    fills: [],
    blendMode: frameBlend,
    effects: frameEffects
  })
  graph.createNode('RECTANGLE', frame.id, {
    x: 25,
    y: 25,
    width: 10,
    height: 10,
    fills: solidFill(1, 1, 1),
    blendMode: childBlend
  })
  return { graph, pageId: page.id, frameId: frame.id }
}

// Figma exports a layer by itself, without the page around and behind it, even when it blends.
test('selection export leaves out page neighbours when only a descendant blends', () => {
  const { graph, pageId, frameId } = frameOverNeighbour('PASS_THROUGH', 'MULTIPLY')
  const pixelAt = exportedRgba(graph, pageId, frameId)

  expect(pixelAt(5, 5)[3]).toBe(0)
  expect(pixelAt(30, 30)).toEqual([255, 255, 255, 255])
})

test('selection export leaves out page neighbours when the node itself blends', () => {
  const { graph, pageId, frameId } = frameOverNeighbour('MULTIPLY', 'NORMAL')
  const pixelAt = exportedRgba(graph, pageId, frameId)

  expect(pixelAt(5, 5)[3]).toBe(0)
  expect(pixelAt(30, 30)).toEqual([255, 255, 255, 255])
})

test('selection export leaves out page neighbours when the node blurs its background', () => {
  const backgroundBlur: Effect = {
    type: 'BACKGROUND_BLUR',
    radius: 16,
    spread: 0,
    offset: { x: 0, y: 0 },
    color: { r: 0, g: 0, b: 0, a: 1 },
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false
  }
  const { graph, pageId, frameId } = frameOverNeighbour('PASS_THROUGH', 'NORMAL', [backgroundBlur])
  const pixelAt = exportedRgba(graph, pageId, frameId)

  expect(pixelAt(5, 5)[3]).toBe(0)
  expect(pixelAt(30, 30)).toEqual([255, 255, 255, 255])
})
