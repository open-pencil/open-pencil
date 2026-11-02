import { afterAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { renderRow } from '#core-tests/helpers/figma-rows'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import type { SceneGraph, Stroke } from '@open-pencil/scene-graph'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const SIZE = 160
const WEIGHT = 8
const RED = { r: 1, g: 0, b: 0, a: 1 }

const BLUE_CHANNEL = 2

function strokedUnion(align: Stroke['align']) {
  return (graph: SceneGraph, hostId: string) => {
    const operation = graph.createNode('BOOLEAN_OPERATION', hostId, {
      x: 120,
      y: 70,
      width: SIZE,
      height: SIZE,
      booleanOperation: 'UNION',
      fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }],
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 1, a: 1 },
          opacity: 1,
          visible: true,
          weight: WEIGHT,
          align
        }
      ],
      strokeWeight: WEIGHT,
      strokeAlign: align
    })
    graph.createNode('RECTANGLE', operation.id, {
      width: SIZE,
      height: SIZE,
      fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
    })
    graph.createNode('RECTANGLE', operation.id, {
      width: 10,
      height: 10,
      fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
    })
  }
}

function leftEdgeStroke(align: Stroke['align']): number[] {
  return renderRow(ck, renderer, strokedUnion(align), 150, 104, 134, BLUE_CHANNEL)
}

describe('a boolean operation’s own stroke', () => {
  test('lies outside the result when aligned outside', () => {
    expect(leftEdgeStroke('OUTSIDE')).toEqual([
      0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0
    ])
  })

  test('lies within the result when aligned inside', () => {
    expect(leftEdgeStroke('INSIDE')).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0
    ])
  })

  test('straddles the outline when centred', () => {
    expect(leftEdgeStroke('CENTER')).toEqual([
      0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0
    ])
  })
})
