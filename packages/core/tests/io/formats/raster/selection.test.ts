import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Effect } from '@open-pencil/scene-graph'

const ck = await initCanvasKit()

function solidFill(r: number, g: number, b: number) {
  return [{ type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }]
}

function exportedRgba(graph: SceneGraph, pageId: string, nodeIds: string | string[]) {
  const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, pageId, [nodeIds].flat(), {
        scale: 1,
        format: 'PNG'
      }),
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

/** A blue square under a white one that overlaps its right half, both on the page. */
function overlappingPair(topBlend: 'NORMAL' | 'MULTIPLY', topColor = solidFill(1, 1, 1)) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const bottom = graph.createNode('RECTANGLE', page.id, {
    width: 40,
    height: 40,
    fills: solidFill(0, 0, 1)
  })
  const top = graph.createNode('RECTANGLE', page.id, {
    x: 20,
    width: 40,
    height: 40,
    fills: topColor,
    blendMode: topBlend
  })
  return { graph, pageId: page.id, ids: [top.id, bottom.id] }
}

test('a multi-layer export stacks the layers as the page does, whatever order they are given in', () => {
  const { graph, pageId, ids } = overlappingPair('NORMAL', solidFill(1, 0, 0))
  expect(exportedRgba(graph, pageId, ids)(30, 20)).toEqual([255, 0, 0, 255])
})

test('a layer blends with the selected layers under it', () => {
  const multiply = overlappingPair('MULTIPLY')
  expect(exportedRgba(multiply.graph, multiply.pageId, multiply.ids)(30, 20)).toEqual([
    0, 0, 255, 255
  ])
  const normal = overlappingPair('NORMAL')
  expect(exportedRgba(normal.graph, normal.pageId, normal.ids)(30, 20)).toEqual([
    255, 255, 255, 255
  ])
})

test('a background blur blurs the selected layers behind it', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const left = graph.createNode('RECTANGLE', page.id, {
    width: 20,
    height: 40,
    fills: solidFill(0, 0, 0)
  })
  const right = graph.createNode('RECTANGLE', page.id, {
    x: 20,
    width: 20,
    height: 40,
    fills: solidFill(1, 1, 1)
  })
  const glass = graph.createNode('FRAME', page.id, {
    width: 40,
    height: 40,
    fills: [{ ...solidFill(1, 1, 1)[0], opacity: 0.01 }],
    effects: [
      {
        type: 'BACKGROUND_BLUR',
        radius: 16,
        spread: 0,
        offset: { x: 0, y: 0 },
        color: { r: 0, g: 0, b: 0, a: 1 },
        visible: true,
        blendMode: 'NORMAL',
        showShadowBehindNode: false
      }
    ]
  })
  const [red] = exportedRgba(graph, page.id, [left.id, right.id, glass.id])(18, 20)
  // Sharp, the black half reads 0 beside the edge; blurred, the white half bleeds into it.
  expect(red).toBeGreaterThan(40)
})

test('selection export draws a selected layer once when its frame is selected too', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id, {
    x: 20,
    y: 20,
    width: 40,
    height: 40,
    fills: []
  })
  const child = graph.createNode('RECTANGLE', frame.id, {
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    fills: solidFill(1, 1, 1),
    opacity: 0.5
  })
  const pixelAt = exportedRgba(graph, page.id, [frame.id, child.id])

  expect(pixelAt(10, 10)[3]).toBe(128)
  expect(pixelAt(30, 30)[3]).toBe(0)
})
