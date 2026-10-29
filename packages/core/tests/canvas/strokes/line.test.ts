import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type SceneNode, type Stroke } from '@open-pencil/scene-graph'

import { silhouetteBounds } from '#core/canvas/shadows/silhouette'
import { makeLineStrokeOutline } from '#core/canvas/strokes/line'

import { expectDefined } from '#core-tests/helpers/assert'

const SIZE = 400

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface'))
afterAll(() => renderer.destroy())

/** Draws a 300 px line at (50, 200) with a 6 px black stroke and returns its pixels' alpha. */
function drawLine(props: Partial<SceneNode> = {}, stroke: Partial<Stroke> = {}): Uint8Array {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  graph.createNode('LINE', page, {
    x: 50,
    y: 200,
    width: 300,
    height: 0,
    fills: [],
    strokeWeight: 6,
    ...props,
    strokes: [
      {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        weight: 6,
        align: 'CENTER',
        ...stroke
      }
    ]
  })
  renderer.pageId = page
  const canvas = renderer.surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  renderer.renderSceneToCanvas(canvas, graph, page)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: SIZE,
        height: SIZE,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    return Uint8Array.from({ length: SIZE * SIZE }, (_, index) => pixels[index * 4 + 3])
  } finally {
    image.delete()
  }
}

/** The painted pixels' bounds, as [left, top, right, bottom] inclusive. */
function paintedBox(alpha: Uint8Array): number[] {
  const box = [SIZE, SIZE, -1, -1]
  alpha.forEach((value, index) => {
    if (value === 0) return
    const x = index % SIZE
    const y = Math.floor(index / SIZE)
    box[0] = Math.min(box[0], x)
    box[1] = Math.min(box[1], y)
    box[2] = Math.max(box[2], x)
    box[3] = Math.max(box[3], y)
  })
  return box
}

// Figma 126 strokes a line a full weight to its upper side, whatever the stroke's alignment, and
// keeps caps and heads inside its length: a 300 px line with a 6 px stroke gives the stroke
// geometry `M0 -3 L0 0 L300 0 L300 -6 L0 -6 Z`, and its export paints rows 194–199 at y 200.
describe('a line stroke', () => {
  test('draws a full weight above the line', () => {
    expect(paintedBox(drawLine())).toEqual([50, 194, 349, 199])
  })

  test('ignores the stroke alignment', () => {
    expect(paintedBox(drawLine({}, { align: 'INSIDE' }))).toEqual([50, 194, 349, 199])
    expect(paintedBox(drawLine({}, { align: 'OUTSIDE' }))).toEqual([50, 194, 349, 199])
  })

  test('keeps round and square caps inside its length', () => {
    expect(paintedBox(drawLine({}, { cap: 'ROUND' }))).toEqual([50, 194, 349, 199])
    expect(paintedBox(drawLine({}, { cap: 'SQUARE' }))).toEqual([50, 194, 349, 199])
  })

  test('keeps a triangle head inside its length, on the middle of the stroke', () => {
    expect(paintedBox(drawLine({}, { cap: 'TRIANGLE_FILLED' }))).toEqual([53, 179, 346, 214])
  })

  test('turns its stroke with the line', () => {
    expect(paintedBox(drawLine({ rotation: 90 }))).toEqual([50, 200, 55, 399])
  })

  test('stretches its dashes to whole periods, with half a dash at each end', () => {
    // Dashes of 10 and gaps of 5 fit 20 times into 300: 0–5, 10–20, 25–35 … 295–300.
    const alpha = drawLine({}, { dashPattern: [10, 5] })
    const row = Array.from({ length: SIZE }, (_, x) => alpha[197 * SIZE + x] > 0)
    expect(row.slice(50, 55).every(Boolean)).toBe(true)
    expect(row.slice(55, 60).some(Boolean)).toBe(false)
    expect(row.slice(60, 70).every(Boolean)).toBe(true)
    expect(row.slice(345, 350).every(Boolean)).toBe(true)
    expect(row[350]).toBe(false)
  })
})

// Booleans and flattening take a line as its stroke outline: Figma's stroke geometry for a 300 px
// line with a 6 px stroke and triangle heads spans x 3 to 297 and y -20.32 to 14.32.
describe('a line taken as a boolean operand', () => {
  test('keeps its heads and the shaft between them', () => {
    const graph = new SceneGraph()
    const line = graph.createNode('LINE', graph.getPages()[0].id, {
      width: 300,
      height: 0,
      strokeCap: 'TRIANGLE_FILLED',
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          weight: 6,
          align: 'CENTER'
        }
      ]
    })
    const outline = expectDefined(makeLineStrokeOutline(renderer, line), 'outline')
    const [left, top, right, bottom] = outline.getBounds()
    outline.delete()
    expect(left).toBeCloseTo(3, 3)
    expect(top).toBeCloseTo(-20.3205, 3)
    expect(right).toBeCloseTo(297, 3)
    expect(bottom).toBeCloseTo(14.3205, 3)
  })
})

describe('a line casts from its whole stroke', () => {
  test('its shadow reaches a full weight past the line, whatever the alignment', () => {
    const graph = new SceneGraph()
    const line = graph.createNode('LINE', graph.getPages()[0].id, {
      width: 300,
      height: 0,
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          weight: 6,
          align: 'INSIDE'
        }
      ],
      effects: [
        {
          type: 'DROP_SHADOW',
          radius: 0,
          spread: 0,
          offset: { x: 0, y: 0 },
          color: { r: 0, g: 0, b: 0, a: 1 },
          visible: true,
          blendMode: 'NORMAL',
          showShadowBehindNode: false
        }
      ]
    })
    const bounds = expectDefined(silhouetteBounds(graph, line, false), 'bounds')
    expect(bounds.y).toBeLessThanOrEqual(-6)
  })
})
