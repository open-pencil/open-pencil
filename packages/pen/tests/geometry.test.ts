import { describe, expect, test } from 'bun:test'

import type { PenNode } from '@open-pencil/pen'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { expectDefined, getNodeOrThrow } from './helpers/assert'
import { parseDocument } from './helpers/document'

function nodeIn(children: PenNode[], id: string) {
  return getNodeOrThrow(
    parseDocument([
      { id: 'page', type: 'frame', layout: 'none', width: 600, height: 400, children }
    ]),
    id
  )
}

/** Where a layer's local point lands in its parent, the way the renderer draws it. */
function pointInParent(graph: SceneGraph, id: string, x: number, y: number) {
  const [px, py] = Matrix.mapPoints(getNodeLocalMatrix(getNodeOrThrow(graph, id)), [x, y])
  return { x: px, y: py }
}

function expectPoint(actual: Vector, x: number, y: number) {
  expect(actual.x).toBeCloseTo(x, 6)
  expect(actual.y).toBeCloseTo(y, 6)
}

const rect = (id: string, fields: Partial<PenNode>): PenNode => ({
  id,
  type: 'rectangle',
  width: 100,
  height: 60,
  ...fields
})

describe('parsePenFile — shapes', () => {
  test('reads an ellipse arc, counter-clockwise in pen.dev and clockwise in the scene graph', () => {
    const node = nodeIn(
      [
        {
          id: 'arc',
          type: 'ellipse',
          width: 100,
          height: 80,
          startAngle: 30,
          sweepAngle: 200,
          innerRadius: 0.4
        }
      ],
      'arc'
    )
    expect(node.arcData?.startingAngle).toBeCloseTo((-30 * Math.PI) / 180)
    expect(node.arcData?.endingAngle).toBeCloseTo((-230 * Math.PI) / 180)
    expect(node.arcData?.innerRadius).toBe(0.4)
  })

  test('keeps a whole ellipse without arc data', () => {
    expect(
      nodeIn([{ id: 'oval', type: 'ellipse', width: 100, height: 80 }], 'oval').arcData
    ).toBeNull()
  })

  test('reads polygons with their side count and corner radius', () => {
    const node = nodeIn(
      [{ id: 'pent', type: 'polygon', width: 100, height: 80, polygonCount: 5, cornerRadius: 10 }],
      'pent'
    )
    expect(node.type).toBe('POLYGON')
    expect(node.pointCount).toBe(5)
    expect(node.cornerRadius).toBe(10)
  })

  test('maps a path view box onto the layer box instead of stretching the geometry', () => {
    const node = nodeIn(
      [
        {
          id: 'tri',
          type: 'path',
          width: 100,
          height: 80,
          geometry: 'M0 0 L50 0 L50 50 Z',
          viewBox: [0, 0, 100, 100]
        }
      ],
      'tri'
    )
    const xs = expectDefined(node.vectorNetwork).vertices.map((vertex) => vertex.x)
    const ys = expectDefined(node.vectorNetwork).vertices.map((vertex) => vertex.y)
    expect(Math.max(...xs)).toBeCloseTo(50)
    expect(Math.max(...ys)).toBeCloseTo(40)
  })

  test('keeps an even-odd fill rule', () => {
    const node = nodeIn(
      [
        {
          id: 'ring',
          type: 'path',
          width: 100,
          height: 80,
          fillRule: 'evenodd',
          geometry: 'M0 0H100V80H0Z M25 20H75V60H25Z'
        }
      ],
      'ring'
    )
    expect(
      expectDefined(node.vectorNetwork).regions.every((region) => region.windingRule === 'EVENODD')
    ).toBe(true)
  })
})

// Measured on pen.dev 2.21: a layer turns counter-clockwise about its x, y corner, and mirrors
// about that corner in its own axes, after turning.
describe('parsePenFile — turned and mirrored layers', () => {
  function graphOf(children: PenNode[]) {
    return parseDocument([
      { id: 'page', type: 'frame', layout: 'none', width: 600, height: 400, children }
    ])
  }

  test('turns a layer counter-clockwise about its top-left corner', () => {
    const graph = graphOf([rect('turned', { x: 60, y: 40, rotation: 30 })])
    const cos = Math.cos(Math.PI / 6)
    expectPoint(pointInParent(graph, 'turned', 0, 0), 60, 40)
    expectPoint(pointInParent(graph, 'turned', 100, 0), 60 + 100 * cos, 40 - 50)
  })

  test('mirrors a layer about its corner, in its own axes', () => {
    const graph = graphOf([rect('mirrored', { x: 220, y: 40, rotation: 30, flipX: true })])
    const node = getNodeOrThrow(graph, 'mirrored')
    expect(node.flipX).toBe(true)
    expectPoint(pointInParent(graph, 'mirrored', 0, 0), 220, 40)
    // The local right edge lands to the left of the corner.
    expectPoint(
      pointInParent(graph, 'mirrored', 100, 0),
      220 - 100 * Math.cos(Math.PI / 6),
      40 + 50
    )
  })

  test('mirrors an upright layer to the left of its x', () => {
    const graph = graphOf([rect('flipped', { x: 340, y: 40, flipX: true })])
    expectPoint(pointInParent(graph, 'flipped', 0, 0), 340, 40)
    expect(getNodeOrThrow(graph, 'flipped').x).toBeCloseTo(240)
  })

  test('fits a group to its layers and turns it about its own origin', () => {
    const graph = graphOf([
      {
        id: 'group',
        type: 'group',
        x: 80,
        y: 180,
        rotation: 20,
        children: [
          rect('a', { x: 10, y: 5, width: 80, height: 40 }),
          { id: 'b', type: 'ellipse', x: 90, y: 20, width: 30, height: 30 }
        ]
      }
    ])
    const group = getNodeOrThrow(graph, 'group')
    expect(group.type).toBe('GROUP')
    expect([group.width, group.height]).toEqual([110, 45])
    const angle = (20 * Math.PI) / 180
    // Layer a's corner sits at (10, 5) in the group's pen.dev space.
    const [ax, ay] = Matrix.mapPoints(
      Matrix.multiply(getNodeLocalMatrix(group), getNodeLocalMatrix(getNodeOrThrow(graph, 'a'))),
      [0, 0]
    )
    expect(ax).toBeCloseTo(80 + 10 * Math.cos(angle) + 5 * Math.sin(angle))
    expect(ay).toBeCloseTo(180 - 10 * Math.sin(angle) + 5 * Math.cos(angle))
  })
})
