import { afterAll, describe, expect, test } from 'bun:test'

import { expectFigmaRow, renderRow, type FigmaRowScene } from '#core-tests/helpers/figma-rows'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import {
  SceneGraph,
  type Effect,
  type Fill,
  type VectorNetwork,
  type VectorSegment
} from '@open-pencil/scene-graph'
import { maxOf } from '@open-pencil/scene-graph/arrays'
import { expectDefined } from '@open-pencil/test-support/assert'

import { isolatesInnerShadows } from '#core/canvas/shadows/render'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const RED = { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0, a: 1 }, visible: true }

const SHARP_INNER_SHADOW = {
  type: 'INNER_SHADOW' as const,
  radius: 0,
  spread: 6,
  offset: { x: 8, y: 8 },
  color: { r: 0, g: 0, b: 0, a: 1 },
  visible: true,
  blendMode: 'NORMAL' as const,
  showShadowBehindNode: false
}

function roundedSquare(opacity: number): FigmaRowScene {
  return (graph, hostId) =>
    graph.createNode('RECTANGLE', hostId, {
      x: 120,
      y: 70,
      width: 160,
      height: 160,
      cornerRadius: 40,
      fills: [{ ...RED, opacity }],
      effects: [SHARP_INNER_SHADOW]
    })
}

// Figma 126 paints the shadowed edge of a rounded rectangle in the shadow alone, at the edge's
// coverage and at full strength over a translucent fill: row 90 from x 119 to 139 of its export.
const FIGMA_RED = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const FIGMA_ALPHA = [0, 0, 0, 223, 255, 255, 255, 255, 255, 255, 255]

describe('an inner shadow over a rounded edge', () => {
  for (const opacity of [1, 0.5]) {
    test(`shows none of a fill at ${opacity * 100}% through the edge`, () => {
      const scene = roundedSquare(opacity)
      expectFigmaRow(renderRow(ck, renderer, scene, 90, 119, 139, 0), FIGMA_RED)
      expectFigmaRow(renderRow(ck, renderer, scene, 90, 119, 139), FIGMA_ALPHA)
    })
  }
})

// A layer of their own would blend a fill with nothing under it, so blended fills stay in place.
describe('fills and inner shadows take a layer of their own', () => {
  function vector(blendMode: 'NORMAL' | 'MULTIPLY') {
    const graph = new SceneGraph()
    return graph.createNode('VECTOR', graph.getPages()[0].id, {
      width: 100,
      height: 100,
      fills: [{ ...RED, opacity: 1 }],
      vectorNetwork: {
        vertices: [],
        segments: [],
        regions: [{ windingRule: 'NONZERO', loops: [], fills: [{ ...RED, opacity: 1, blendMode }] }]
      },
      effects: [SHARP_INNER_SHADOW]
    })
  }

  test('unless a region of a vector fills with a blend', () => {
    expect(isolatesInnerShadows(vector('NORMAL'))).toBe(true)
    expect(isolatesInnerShadows(vector('MULTIPLY'))).toBe(false)
  })
})

// Figma 126 casts a drop shadow from a region that takes the layer's fill, and none from one
// whose own fill list is empty: two 40px squares, the left one empty, shadow 30px below.
describe('a drop shadow of a vector with region fills', () => {
  const zero = { x: 0, y: 0 }
  const line = (start: number, end: number) => ({
    start,
    end,
    tangentStart: zero,
    tangentEnd: zero
  })
  const squares =
    (leftFills: Fill[] | undefined): FigmaRowScene =>
    (graph, hostId) =>
      graph.createNode('VECTOR', hostId, {
        x: 100,
        y: 100,
        width: 80,
        height: 40,
        fills: [{ ...RED, color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, opacity: 1 }],
        vectorNetwork: {
          vertices: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 40 },
            { x: 0, y: 40 },
            { x: 80, y: 0 },
            { x: 80, y: 40 }
          ],
          segments: [
            line(0, 1),
            line(1, 2),
            line(2, 3),
            line(3, 0),
            line(1, 4),
            line(4, 5),
            line(5, 2)
          ],
          regions: [
            { windingRule: 'NONZERO', loops: [[0, 1, 2, 3]], fills: leftFills },
            { windingRule: 'NONZERO', loops: [[4, 5, 6, 1]], fills: [{ ...RED, opacity: 1 }] }
          ]
        },
        effects: [
          {
            type: 'DROP_SHADOW',
            radius: 0,
            spread: 0,
            offset: { x: 0, y: 30 },
            color: { r: 0, g: 0, b: 0, a: 1 },
            visible: true,
            blendMode: 'NORMAL',
            showShadowBehindNode: false
          }
        ]
      })

  // Row 165 is below both squares, where only their shadows reach: x 110–130 under the left one.
  test('casts none from a region with no paint', () => {
    expect(renderRow(ck, renderer, squares([]), 165, 110, 130)).toEqual(
      Array.from({ length: 11 }, () => 0)
    )
    expect(renderRow(ck, renderer, squares([]), 165, 150, 170)).toEqual(
      Array.from({ length: 11 }, () => 255)
    )
  })

  test('casts none from a region whose only paint is hidden', () => {
    const hidden = [{ ...RED, opacity: 1, visible: false }]
    expect(renderRow(ck, renderer, squares(hidden), 165, 110, 130)).toEqual(
      Array.from({ length: 11 }, () => 0)
    )
  })

  test("casts from a region that takes the layer's fill", () => {
    expect(renderRow(ck, renderer, squares(undefined), 165, 110, 130)).toEqual(
      Array.from({ length: 11 }, () => 255)
    )
  })
})

function line(start: number, end: number): VectorSegment {
  return { start, end, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
}

function sharpShadow(type: 'DROP_SHADOW' | 'INNER_SHADOW', offsetY: number): Effect {
  return {
    type,
    radius: 0,
    spread: 0,
    offset: { x: 0, y: offsetY },
    color: { r: 0, g: 0, b: 0, a: 0.5 },
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false
  }
}

const SQUARE_LOOP = [0, 1, 2, 3]

function stackedSquares(regionCount: number): VectorNetwork {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 }
    ],
    segments: [line(0, 1), line(1, 2), line(2, 3), line(3, 0)],
    regions: Array.from({ length: regionCount }, () => ({
      windingRule: 'NONZERO' as const,
      loops: [SQUARE_LOOP]
    }))
  }
}

const SAME_WINDING = [4, 5, 6, 7]
const OPPOSITE_WINDING = [7, 6, 5, 4]

function shiftedSquares(secondLoop: number[]): VectorNetwork {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
      { x: 20, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 40 },
      { x: 20, y: 40 }
    ],
    segments: [
      line(0, 1),
      line(1, 2),
      line(2, 3),
      line(3, 0),
      line(4, 5),
      line(5, 6),
      line(6, 7),
      line(7, 4)
    ],
    regions: [
      { windingRule: 'NONZERO', loops: [SQUARE_LOOP] },
      { windingRule: 'NONZERO', loops: [secondLoop] }
    ]
  }
}

function regionVector(network: VectorNetwork, effect: Effect, fillOpacity = 1): FigmaRowScene {
  return (graph, hostId) =>
    graph.createNode('VECTOR', hostId, {
      x: 100,
      y: 100,
      width: maxOf(network.vertices.map((vertex) => vertex.x)),
      height: 40,
      fills: [{ ...RED, opacity: fillOpacity }],
      vectorNetwork: network,
      effects: [effect]
    })
}

describe('a drop shadow of a vector whose regions overlap', () => {
  const dropShadow = sharpShadow('DROP_SHADOW', 30)

  test('casts one shadow from the area they cover together', () => {
    const single = renderRow(
      ck,
      renderer,
      regionVector(stackedSquares(1), dropShadow),
      165,
      110,
      130
    )
    expect(single).toEqual(Array.from({ length: 11 }, () => 128))
    expect(
      renderRow(ck, renderer, regionVector(stackedSquares(3), dropShadow), 165, 110, 130)
    ).toEqual(single)
  })

  test('keeps the shadow even where only part of them overlaps', () => {
    const shifted = regionVector(shiftedSquares(SAME_WINDING), dropShadow)
    expect(renderRow(ck, renderer, shifted, 165, 104, 156)).toEqual(
      Array.from({ length: 27 }, () => 128)
    )
  })
})

describe('a vector whose overlapping regions wind in opposite directions', () => {
  const WHITE: Fill = {
    type: 'SOLID',
    color: { r: 1, g: 1, b: 1, a: 1 },
    opacity: 1,
    visible: true
  }
  const onWhite =
    (secondLoop: number[], effect: Effect): FigmaRowScene =>
    (graph, hostId) => {
      graph.createNode('RECTANGLE', hostId, { width: 400, height: 300, fills: [WHITE] })
      regionVector(shiftedSquares(secondLoop), effect, 0.1)(graph, hostId)
    }
  const GREEN = 1
  const rowAt = (secondLoop: number[], effect: Effect, y: number) =>
    renderRow(ck, renderer, onWhite(secondLoop, effect), y, 102, 158, GREEN)

  // Figma reads 206 in the green channel over the overlap: both 10% fills, no shadow under them.
  test('hides the drop shadow under the overlap', () => {
    const dropShadow = sharpShadow('DROP_SHADOW', 10)
    const overlap = (secondLoop: number[]) =>
      renderRow(ck, renderer, onWhite(secondLoop, dropShadow), 130, 122, 138, GREEN)
    expectFigmaRow(
      overlap(OPPOSITE_WINDING),
      Array.from({ length: 9 }, () => 206)
    )
    expect(overlap(SAME_WINDING)).toEqual(overlap(OPPOSITE_WINDING))
  })

  test('casts the inner shadow from the outline they cover together', () => {
    const innerShadow = sharpShadow('INNER_SHADOW', 10)
    const rows = (secondLoop: number[]) =>
      [110, 130, 148].map((y) => rowAt(secondLoop, innerShadow, y))
    expect(rows(OPPOSITE_WINDING)).toEqual(rows(SAME_WINDING))
  })
})
