import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Stroke, type VectorNetwork } from '@open-pencil/scene-graph'
import { maxOf } from '@open-pencil/scene-graph/arrays'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const FRAME = 120
const LEFT = 40
const TOP = 40
const zero = { x: 0, y: 0 }

function squares(offsets: number[], regionLoops: number[][]): VectorNetwork {
  const vertices = offsets.flatMap((x) => [
    { x, y: 0 },
    { x: x + 40, y: 0 },
    { x: x + 40, y: 40 },
    { x, y: 40 }
  ])
  const segments = offsets.flatMap((_, square) =>
    [0, 1, 2, 3].map((corner) => ({
      start: square * 4 + corner,
      end: square * 4 + ((corner + 1) % 4),
      tangentStart: zero,
      tangentEnd: zero
    }))
  )
  const loop = (square: number) => [0, 1, 2, 3].map((side) => square * 4 + side)
  return {
    vertices,
    segments,
    regions: regionLoops.map((loops) => ({ windingRule: 'NONZERO', loops: loops.map(loop) }))
  }
}

/**
 * The red channel of row `y` from `x0` to `x1` of a red vector with a 4px stroke of 50% black,
 * placed at (40, 40) in a white 120 × 120 frame, as Figma's export of the same frame reads.
 */
function redRow(
  network: VectorNetwork,
  align: Stroke['align'],
  y: number,
  x0: number,
  x1: number
): number[] {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const host = graph.createNode('FRAME', page, {
    width: FRAME,
    height: FRAME,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
    clipsContent: true
  })
  const width = maxOf(network.vertices.map((vertex) => vertex.x))
  const height = maxOf(network.vertices.map((vertex) => vertex.y))
  graph.createNode('VECTOR', host.id, {
    x: LEFT,
    y: TOP,
    width,
    height,
    vectorNetwork: network,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    strokes: [
      {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0, a: 1 },
        weight: 4,
        opacity: 0.5,
        visible: true,
        align,
        cap: 'NONE',
        join: 'MITER',
        dashPattern: []
      }
    ]
  })
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, page, [host.id], {
      scale: 1,
      format: 'PNG',
      trimTransparent: false
    })
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png))
  try {
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: image.width(),
        height: image.height(),
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    return Array.from({ length: x1 - x0 + 1 }, (_, i) => pixels[(y * image.width() + x0 + i) * 4])
  } finally {
    image.delete()
  }
}

const ONE = squares([0], [[0]])
const THREE_SAME = squares([0], [[0], [0], [0]])
const TWO_SAME = squares([0], [[0], [0]])
const THREE_PARTIAL = squares([0, 10, 20], [[0], [1], [2]])

// Figma 126, 4px of 50% black on red over white, read across the left edge at row 60 (x 34..47)
// and down through the top edge at x 70 (y 34..47).
describe('a stroke on a vector with several regions', () => {
  test('outside: a segment shared by regions strokes centred, once', () => {
    expect(redRow(ONE, 'OUTSIDE', 60, 34, 47)).toEqual([
      255, 255, 127, 127, 127, 127, 255, 255, 255, 255, 255, 255, 255, 255
    ])
    const shared = [255, 255, 255, 255, 127, 127, 255, 255, 255, 255, 255, 255, 255, 255]
    expect(redRow(THREE_SAME, 'OUTSIDE', 60, 34, 47)).toEqual(shared)
    expect(redRow(TWO_SAME, 'OUTSIDE', 60, 34, 47)).toEqual(shared)
  })

  test('outside: overlapping regions stroke their outer edge once', () => {
    expect(redRow(THREE_PARTIAL, 'OUTSIDE', 60, 34, 47)).toEqual([
      255, 255, 127, 127, 127, 127, 255, 255, 255, 255, 255, 255, 255, 255
    ])
    const column = topColumn(THREE_PARTIAL, 'OUTSIDE')
    expect(column).toEqual([255, 255, 127, 127, 127, 127, 255, 255, 255, 255, 255, 255, 255, 255])
  })

  test('inside: shared segments stroke centred, edges inside overlaps stroke doubled', () => {
    expect(redRow(THREE_SAME, 'INSIDE', 60, 36, 47)).toEqual([
      255, 255, 255, 255, 127, 127, 255, 255, 255, 255, 255, 255
    ])
    const edge = [127, 127, 127, 127]
    const doubled = [...edge, ...edge]
    const red = (width: number) => Array.from({ length: width }, () => 255)
    expect(redRow(THREE_PARTIAL, 'INSIDE', 60, 36, 103)).toEqual([
      ...red(4),
      ...edge,
      ...red(2),
      ...doubled,
      ...red(2),
      ...doubled,
      ...red(12),
      ...doubled,
      ...red(2),
      ...doubled,
      ...red(2),
      ...edge,
      ...red(4)
    ])
    expect(topColumn(THREE_PARTIAL, 'INSIDE')).toEqual([
      255, 255, 255, 255, 255, 255, 127, 127, 127, 127, 255, 255, 255, 255
    ])
  })
})

describe('a centred stroke on a vector with several regions', () => {
  test('strokes each segment once, as one region does', () => {
    const single = redRow(ONE, 'CENTER', 60, 34, 47)
    expect(single).toEqual([255, 255, 255, 255, 127, 127, 127, 127, 255, 255, 255, 255, 255, 255])
    expect(redRow(THREE_SAME, 'CENTER', 60, 34, 47)).toEqual(single)
  })

  test('still strokes a segment outside every region', () => {
    const withLine: VectorNetwork = {
      vertices: [...THREE_SAME.vertices, { x: 60, y: 0 }, { x: 60, y: 40 }],
      segments: [
        ...THREE_SAME.segments,
        { start: 4, end: 5, tangentStart: zero, tangentEnd: zero }
      ],
      regions: THREE_SAME.regions
    }
    for (const align of ['CENTER', 'OUTSIDE', 'INSIDE'] as const) {
      expect(redRow(withLine, align, 60, 96, 103)).toEqual([255, 255, 127, 127, 127, 127, 255, 255])
    }
  })
})

function network(
  points: [number, number][],
  segments: [number, number][],
  regionLoops: number[][][]
): VectorNetwork {
  return {
    vertices: points.map(([x, y]) => ({ x, y })),
    segments: segments.map(([start, end]) => ({
      start,
      end,
      tangentStart: zero,
      tangentEnd: zero
    })),
    regions: regionLoops.map((loops) => ({ windingRule: 'NONZERO', loops }))
  }
}

const SQUARE_CORNERS: [number, number][] = [
  [0, 0],
  [40, 0],
  [40, 40],
  [0, 40]
]
const DIAGONAL_HALVES = network(
  SQUARE_CORNERS,
  [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [0, 2]
  ],
  [[[0, 1, 4]], [[4, 2, 3]]]
)
const TOP_LEFT_QUARTER = network(
  [
    [0, 0],
    [20, 0],
    [40, 0],
    [40, 40],
    [0, 40],
    [0, 20],
    [20, 20]
  ],
  [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 0],
    [1, 6],
    [6, 5]
  ],
  [[[0, 1, 2, 3, 4, 5]], [[0, 6, 7, 5]]]
)
const CROSSED_LOOPS = network(
  [
    [0, 0],
    [30, 0],
    [30, 30],
    [0, 30],
    [10, 10],
    [10, 40],
    [40, 40],
    [40, 10]
  ],
  [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4]
  ],
  [[[0, 1, 2, 3]], [[4, 5, 6, 7]]]
)

describe('corners where regions meet on the outline', () => {
  test('join where the outline turns past an edge between regions', () => {
    const stroke = [127, 127, 127, 127, 127, 127, 127, 127, 127]
    expect(redRow(DIAGONAL_HALVES, 'CENTER', 38, 34, 46)).toEqual([255, 255, 255, 255, ...stroke])
    expect(redRow(DIAGONAL_HALVES, 'OUTSIDE', 36, 34, 46)).toEqual([255, 255, ...stroke, 127, 127])
  })

  test('join at a corner only one region reaches', () => {
    const white = (width: number) => Array.from({ length: width }, () => 255)
    const stroke = (width: number) => Array.from({ length: width }, () => 127)
    expect(redRow(DIAGONAL_HALVES, 'CENTER', 38, 76, 85)).toEqual([...stroke(6), ...white(4)])
    expect(redRow(DIAGONAL_HALVES, 'CENTER', 81, 34, 43)).toEqual([...white(4), ...stroke(6)])
  })

  test('outside: a doubled edge stops at its end where a shared edge goes on', () => {
    const white = Array.from({ length: 10 }, () => 255)
    const stroke = (width: number) => Array.from({ length: width }, () => 127)
    expect(redRow(TOP_LEFT_QUARTER, 'OUTSIDE', 37, 50, 65)).toEqual([...white, ...stroke(6)])
    expect(redRow(TOP_LEFT_QUARTER, 'OUTSIDE', 38, 50, 65)).toEqual(stroke(16))
  })

  test('loops wound opposite ways stroke their crossing once', () => {
    const crossing = [127, 127, 127, 127, 127, 127, 127, 127, 127]
    expect(redRow(CROSSED_LOOPS, 'CENTER', 50, 66, 74)).toEqual(crossing)
  })
})

function topColumn(network: VectorNetwork, align: Stroke['align']): number[] {
  const transposed: VectorNetwork = {
    ...network,
    vertices: network.vertices.map(({ x, y }) => ({ x: y, y: x }))
  }
  return redRow(transposed, align, 70, 34, 47)
}
