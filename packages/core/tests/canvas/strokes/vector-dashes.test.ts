import { afterAll, expect, test } from 'bun:test'

import { expectDefined } from '@open-pencil/test-support/assert'
import { SceneGraph, type VectorNetwork } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { SkiaRenderer } from '#core/canvas/renderer'
import { getCanvasKit } from '#core/canvaskit'
import { renderNodesToImage } from '#core/io/formats/raster/render'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1), 'surface'))
afterAll(() => renderer.destroy())

const OUTER = 60
const INNER = { from: 20, to: 40 }
const WEIGHT = 2
const corner = { x: 0, y: 0 }

/** A closed loop through `points`, its vertices numbered from `first`. */
function loop(points: Vector[], first: number) {
  return points.map((_, i) => ({
    start: first + i,
    end: first + ((i + 1) % points.length),
    tangentStart: corner,
    tangentEnd: corner
  }))
}

/** The points along a square's sides, `steps` segments to a side. */
function square(from: number, to: number, steps: number): Vector[] {
  const side = (to - from) / steps
  const along = (i: number) => from + i * side
  return [
    ...Array.from({ length: steps }, (_, i) => ({ x: along(i), y: from })),
    ...Array.from({ length: steps }, (_, i) => ({ x: to, y: along(i) })),
    ...Array.from({ length: steps }, (_, i) => ({ x: to - i * side, y: to })),
    ...Array.from({ length: steps }, (_, i) => ({ x: from, y: to - i * side }))
  ]
}

// A frame-like ring: an outer square of four segments around an inner one whose sides are each
// four 5 px segments, shorter than one dash.
const outer = square(0, OUTER, 1)
const inner = square(INNER.from, INNER.to, 4)
const RING: VectorNetwork = {
  vertices: [...outer, ...inner],
  segments: [...loop(outer, 0), ...loop(inner, outer.length)],
  regions: [
    {
      windingRule: 'EVENODD',
      loops: [
        outer.map((_, i) => i),
        inner.map((_, i) => outer.length + i)
      ]
    }
  ]
}

/** Alpha along the row through `y`, from `x0` to `x1`, of the ring's dashed stroke. */
function strokeRow(y: number, x0: number, x1: number): number[] {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const ring = graph.createNode('VECTOR', page.id, {
    width: OUTER,
    height: OUTER,
    vectorNetwork: RING,
    fills: [],
    strokes: [
      {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0, a: 1 },
        weight: WEIGHT,
        opacity: 1,
        visible: true,
        align: 'CENTER',
        cap: 'NONE',
        join: 'MITER',
        dashPattern: [8, 8]
      }
    ]
  })
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, page.id, [ring.id], { scale: 1, format: 'PNG' }),
    'png'
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
  try {
    // The export starts where the centred stroke's ink reaches, half its weight outside the ring.
    const offset = WEIGHT / 2
    const pixels = expectDefined(
      image.readPixels(x0 + offset, y + offset - 1, {
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
        width: x1 - x0,
        height: 1
      }),
      'pixels'
    )
    return Array.from({ length: x1 - x0 }, (_, i) => pixels[i * 4 + 3])
  } finally {
    image.delete()
  }
}

const gaps = (row: number[]) => row.filter((alpha) => alpha === 0).length

test('a dashed vector dashes its first contour', () => {
  expect(gaps(strokeRow(0, 2, OUTER - 2))).toBeGreaterThan(10)
})

test('a dashed vector dashes every contour after the first, across its short segments', () => {
  // Figma runs the dash pattern on along each contour; restarting it on every 5 px segment
  // inked the inner square solid.
  expect(gaps(strokeRow(INNER.from, INNER.from + 1, INNER.to - 1))).toBeGreaterThan(4)
})
