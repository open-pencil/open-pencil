import { describe, expect, test } from 'bun:test'

import {
  SceneGraph,
  TransformMatrix,
  computeAbsoluteBounds,
  computeBounds,
  degToRad,
  getAbsolutePosition,
  getAbsoluteRotation,
  getWorldHandles,
  getWorldMatrix,
  radToDeg,
  rotatePoint,
  rotatedBBox,
  rotatedCorners,
  type Color,
  type GUID,
  type Matrix,
  type Rect,
  type Vector
} from '@open-pencil/core'

function firstPageId(graph: SceneGraph): string {
  const [page] = graph.getPages()
  if (!page) throw new Error('SceneGraph did not create a default page')
  return page.id
}

describe('@open-pencil/core root scene-graph compatibility exports', () => {
  test('re-exports primitive scene-graph types from the root barrel', () => {
    const guid: GUID = { sessionID: 1, localID: 2 }
    const color: Color = { r: 1, g: 0.5, b: 0, a: 1 }
    const vector: Vector = { x: 3, y: 4 }
    const matrix: Matrix = { m00: 1, m01: 0, m02: 3, m10: 0, m11: 1, m12: 4 }
    const rect: Rect = { x: vector.x, y: vector.y, width: 10, height: 20 }

    expect(guid).toEqual({ sessionID: 1, localID: 2 })
    expect(color.a).toBe(1)
    expect(matrix.m02).toBe(rect.x)
  })

  test('re-exports geometry helpers from the root barrel', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 10)
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 10)
    const rotatedPoint = rotatePoint(10, 0, 0, 0, Math.PI / 2)
    expect(rotatedPoint.x).toBeCloseTo(0, 10)
    expect(rotatedPoint.y).toBeCloseTo(10, 10)
    expect(rotatedCorners(5, 5, 5, 5, 0)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ])
    expect(rotatedBBox(0, 0, 10, 20, 0)).toEqual({
      left: 0,
      right: 10,
      top: 0,
      bottom: 20,
      centerX: 5,
      centerY: 10
    })
    expect(
      computeBounds([
        { x: 10, y: 20, width: 30, height: 40 },
        { x: -5, y: 5, width: 10, height: 10 }
      ])
    ).toEqual({ x: -5, y: 5, width: 45, height: 55 })
  })

  test('re-exports world-transform helpers and matrix utilities from the root barrel', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', firstPageId(graph), {
      x: 10,
      y: 20,
      width: 30,
      height: 40
    })

    expect(getAbsolutePosition(rect, graph)).toEqual({ x: 10, y: 20 })
    expect(getAbsoluteRotation(rect, graph)).toBe(0)
    expect(computeAbsoluteBounds([rect], (id) => graph.getAbsolutePosition(id))).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40
    })

    const worldMatrix = getWorldMatrix(rect, graph)
    expect(TransformMatrix.mapPoint(worldMatrix, { x: 0, y: 0 })).toEqual({ x: 10, y: 20 })
    expect(getWorldHandles(rect, graph).se).toEqual({ x: 40, y: 60 })
  })
})
