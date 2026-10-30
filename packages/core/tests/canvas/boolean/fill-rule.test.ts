import { afterAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Stroke } from '@open-pencil/scene-graph'

import { makeBooleanOperationPath } from '#core/canvas/boolean'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const RED = { r: 1, g: 0, b: 0, a: 1 }
const STRAIGHT = { tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }

function square(first: number, from: number, to: number) {
  return {
    vertices: [
      { x: from, y: from },
      { x: to, y: from },
      { x: to, y: to },
      { x: from, y: to }
    ],
    segments: [0, 1, 2, 3].map((index) => ({
      start: first + index,
      end: first + ((index + 1) % 4),
      ...STRAIGHT
    }))
  }
}

function unionWithEvenOddRing(graph: SceneGraph, strokes: Stroke[]): string {
  const operation = graph.createNode('BOOLEAN_OPERATION', graph.getPages()[0].id, {
    width: 200,
    height: 100,
    booleanOperation: 'UNION',
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
  })
  const outer = square(0, 0, 100)
  const inner = square(4, 30, 70)
  graph.createNode('VECTOR', operation.id, {
    width: 100,
    height: 100,
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }],
    strokes,
    strokeWeight: strokes[0]?.weight ?? 0,
    vectorNetwork: {
      vertices: [...outer.vertices, ...inner.vertices],
      segments: [...outer.segments, ...inner.segments],
      regions: [
        {
          windingRule: 'EVENODD',
          loops: [
            [0, 1, 2, 3],
            [4, 5, 6, 7]
          ]
        }
      ]
    }
  })
  graph.createNode('RECTANGLE', operation.id, {
    x: 150,
    width: 20,
    height: 20,
    fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }]
  })
  return operation.id
}

function coveredPoints(strokes: Stroke[]) {
  const graph = new SceneGraph()
  const operation = expectDefined(graph.getNode(unionWithEvenOddRing(graph, strokes)))
  const path = expectDefined(makeBooleanOperationPath(renderer, operation, graph))
  const covered = {
    ring: path.contains(15, 50),
    hole: path.contains(50, 50),
    rectangle: path.contains(160, 10)
  }
  path.delete()
  return covered
}

describe('a vector boolean operand with one even-odd region', () => {
  test('keeps the hole its fill rule cuts', () => {
    expect(coveredPoints([])).toEqual({ ring: true, hole: false, rectangle: true })
  })

  test('keeps the hole when it also draws a stroke', () => {
    const stroke: Stroke = {
      type: 'SOLID',
      color: RED,
      opacity: 1,
      visible: true,
      weight: 4,
      align: 'CENTER'
    }
    expect(coveredPoints([stroke])).toEqual({ ring: true, hole: false, rectangle: true })
  })
})
