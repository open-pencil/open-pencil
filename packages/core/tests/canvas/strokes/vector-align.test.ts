import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph, type Stroke, type VectorNetwork } from '@open-pencil/scene-graph'
import { strokeOverflow } from '@open-pencil/scene-graph/geometry'

import { SkiaRenderer } from '#core/canvas/renderer'
import { getCanvasKit } from '#core/canvaskit'
import { renderNodesToImage } from '#core/io/formats/raster/render'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

const SIDE = 40
const corner = { x: 0, y: 0 }
const SQUARE: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: SIDE, y: 0 },
    { x: SIDE, y: SIDE },
    { x: 0, y: SIDE }
  ],
  segments: [0, 1, 2, 3].map((start) => ({
    start,
    end: (start + 1) % 4,
    tangentStart: corner,
    tangentEnd: corner
  })),
  regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
}

/** The square's first three sides, open, with no region to fill. */
const OPEN: VectorNetwork = {
  vertices: SQUARE.vertices,
  segments: SQUARE.segments.slice(0, 3),
  regions: []
}

/** The closed square with a separate open line at x = 60 beside it. */
const MIXED: VectorNetwork = {
  vertices: [...SQUARE.vertices, { x: 60, y: 0 }, { x: 60, y: SIDE }],
  segments: [...SQUARE.segments, { start: 4, end: 5, tangentStart: corner, tangentEnd: corner }],
  regions: SQUARE.regions
}

/** Whether the shape's 8 px stroke inks the row through its middle `x` px from its left edge. */
function inks(align: Stroke['align'], network = SQUARE, span = SIDE): (x: number) => boolean {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const vector = graph.createNode('VECTOR', page.id, {
    width: span,
    height: SIDE,
    vectorNetwork: network,
    fills: [],
    strokes: [
      {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0, a: 1 },
        weight: 8,
        opacity: 1,
        visible: true,
        align,
        cap: 'NONE',
        join: 'MITER',
        dashPattern: []
      }
    ]
  })
  const surface = expectDefined(ck.MakeSurface(1, 1), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, page.id, [vector.id], { scale: 1, format: 'PNG' }),
      'png'
    )
    const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
        width: image.width(),
        height: image.height()
      }),
      'pixels'
    )
    // The export starts where the stroke's ink can reach, outside the square's left edge.
    const left = (image.width() - span) / 2
    const row = Math.floor(image.height() / 2)
    const width = image.width()
    image.delete()
    return (x) => pixels[(row * width + Math.floor(left + x)) * 4 + 3] > 128
  } finally {
    surface.delete()
  }
}

// Figma 126 strokes inside or outside a path as a centred stroke twice as wide, clipped.
test('a vector stroked from its path keeps the stroke on the side its alignment takes', () => {
  const center = inks('CENTER')
  expect([center(-6), center(2), center(6)]).toEqual([false, true, false])
  const inside = inks('INSIDE')
  expect([inside(2), inside(6), inside(10)]).toEqual([true, true, false])
  const outside = inks('OUTSIDE')
  expect([outside(-6), outside(2), outside(6)]).toEqual([true, false, false])
})

// An open path encloses nothing to take a side of, so its stroke stays centred at its weight.
test('an open vector path strokes centred whatever its alignment', () => {
  for (const align of ['INSIDE', 'OUTSIDE'] as const) {
    const open = inks(align, OPEN)
    expect([open(34), open(38), open(42), open(46)]).toEqual([false, true, true, false])
  }
})

// Closed regions take the stroke's side; an open line beside them strokes centred, not doubled.
test('a vector with a closed region and an open line aligns only the region', () => {
  const inside = inks('INSIDE', MIXED, 60)
  expect([inside(2), inside(6), inside(54), inside(58), inside(62)]).toEqual([
    true,
    true,
    false,
    true,
    true
  ])
  const outside = inks('OUTSIDE', MIXED, 60)
  expect([outside(-6), outside(2), outside(54), outside(58), outside(62)]).toEqual([
    true,
    false,
    false,
    true,
    true
  ])
})

// Bounds reach as far as that ink: a full stroke out of a closed region, half one beside an open line.
test('stroke bounds reach as far as the side each part of a vector strokes', () => {
  const outside = (align: Stroke['align']): Stroke[] => [
    {
      type: 'SOLID',
      color: { r: 0, g: 0, b: 0, a: 1 },
      weight: 8,
      opacity: 1,
      visible: true,
      align,
      cap: 'NONE',
      join: 'ROUND',
      dashPattern: []
    }
  ]
  expect(strokeOverflow(outside('OUTSIDE'), 'NONE', OPEN)).toBe(4)
  expect(strokeOverflow(outside('OUTSIDE'), 'NONE', MIXED)).toBe(8)
  expect(strokeOverflow(outside('INSIDE'), 'NONE', MIXED)).toBe(4)
  expect(strokeOverflow(outside('INSIDE'), 'NONE', SQUARE)).toBe(0)
})
