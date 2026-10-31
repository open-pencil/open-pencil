import { afterAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { expectFigmaRow, renderRow, type FigmaRowScene } from '#core-tests/helpers/figma-rows'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'

import { isolatesInnerShadows } from '#core/canvas/shadows'

const ck = await initCanvasKit()
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
