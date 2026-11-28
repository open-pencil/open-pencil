import { describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph, type Fill, type Stroke } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const SIZE = 80
const TARGET = { x: 20, y: 20, width: 40, height: 40 }
const WEIGHT = 4

const WHITE = { r: 1, g: 1, b: 1, a: 1 }
const BLACK = { r: 0, g: 0, b: 0, a: 1 }
const GREY = { r: 0.25, g: 0.25, b: 0.25, a: 1 }

function solid(color: Color): Fill {
  return { type: 'SOLID', color, opacity: 1, visible: true }
}

function patternStroke(sourceNodeId: string, align: Stroke['align']): Stroke {
  return {
    type: 'PATTERN',
    color: BLACK,
    opacity: 1,
    visible: true,
    sourceNodeId,
    patternSpacing: { x: 0, y: 0 },
    patternTileType: 'RECTANGULAR',
    horizontalAlignment: 'START',
    verticalAlignment: 'START',
    weight: WEIGHT,
    align
  }
}

type AddLayers = (graph: SceneGraph, pageId: string, sourceId: string) => void

/** A page holding a white pattern source off the surface and `addLayers`; returns its pixels. */
function renderWithPatternSource(addLayers: AddLayers) {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const source = graph.createNode('RECTANGLE', page.id, {
    x: 300,
    y: 300,
    width: 10,
    height: 10,
    fills: [solid(WHITE)]
  })
  addLayers(graph, page.id, source.id)
  const surface = expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    renderer.pageId = page.id
    renderer.renderSceneToCanvas(surface.getCanvas(), graph, page.id)
    surface.flush()
    const image = surface.makeImageSnapshot()
    const pixels = image.readPixels(0, 0, {
      width: SIZE,
      height: SIZE,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    image.delete()
    const read = expectDefined(pixels, 'pixels')
    return (x: number, y: number) =>
      Array.from(read.slice((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 4))
  } finally {
    renderer.destroy()
  }
}

function strokedSquare(align: Stroke['align'], then?: Stroke): AddLayers {
  return (graph, pageId, sourceId) => {
    graph.createNode('RECTANGLE', pageId, {
      ...TARGET,
      fills: [solid(GREY)],
      strokeWeight: WEIGHT,
      strokes: [patternStroke(sourceId, align)]
    })
    if (then) {
      graph.createNode('RECTANGLE', pageId, {
        x: 70,
        y: 0,
        width: 10,
        height: 10,
        fills: [],
        strokeWeight: then.weight,
        strokes: [then]
      })
    }
  }
}

describe('pattern strokes', () => {
  test('draws an inside stroke in the source layer, not in the paint colour', () => {
    const at = renderWithPatternSource(strokedSquare('INSIDE'))

    expect(at(TARGET.x + 1, 40)).toEqual([255, 255, 255, 255])
    expect(at(40, 40)).toEqual([64, 64, 64, 255])
  })

  test('draws an outside stroke in the source layer around the shape', () => {
    const at = renderWithPatternSource(strokedSquare('OUTSIDE'))

    expect(at(TARGET.x - 2, 40)).toEqual([255, 255, 255, 255])
    expect(at(TARGET.x + 1, 40)).toEqual([64, 64, 64, 255])
  })

  test('leaves no pattern on the next layer stroke', () => {
    const red: Stroke = { ...solid({ r: 1, g: 0, b: 0, a: 1 }), weight: 2, align: 'INSIDE' }
    const at = renderWithPatternSource(strokedSquare('INSIDE', red))

    expect(at(70, 5)).toEqual([255, 0, 0, 255])
  })

  test('draws the arrowhead of a line in the source layer', () => {
    const at = renderWithPatternSource((graph, pageId, sourceId) => {
      graph.createNode('LINE', pageId, {
        x: 5,
        y: 70,
        width: 30,
        height: 0,
        strokeCap: 'TRIANGLE_FILLED',
        strokeWeight: WEIGHT,
        strokes: [patternStroke(sourceId, 'CENTER')]
      })
    })

    expect(at(15, 70)).toEqual([255, 255, 255, 255])
  })
})
