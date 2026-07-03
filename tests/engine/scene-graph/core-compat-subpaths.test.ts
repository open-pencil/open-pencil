import { describe, expect, test } from 'bun:test'

import {
  getAbsolutePositionFull,
  getAbsoluteRotation,
  getWorldHandles
} from '@open-pencil/core/canvas'
import { computeBounds, type Vector } from '@open-pencil/core/geometry'
import { SceneGraph } from '@open-pencil/core/scene-graph'
import type { Color, Matrix, Rect } from '@open-pencil/core/types'

function firstPageId(graph: SceneGraph): string {
  const [page] = graph.getPages()
  if (!page) throw new Error('SceneGraph did not create a default page')
  return page.id
}

describe('@open-pencil/core compatibility subpaths', () => {
  test('keeps the legacy scene-graph subpath usable', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', firstPageId(graph), {
      x: 10,
      y: 20,
      width: 30,
      height: 40
    })

    expect(graph.getNode(rect.id)).toBe(rect)
  })

  test('keeps the legacy geometry and types subpaths usable', () => {
    const color: Color = { r: 0.2, g: 0.4, b: 0.6, a: 1 }
    const matrix: Matrix = { m00: 1, m01: 0, m02: 10, m10: 0, m11: 1, m12: 20 }
    const vector: Vector = { x: matrix.m02, y: matrix.m12 }
    const rect: Rect = { x: vector.x, y: vector.y, width: 30, height: 40 }

    expect(color.b).toBeCloseTo(0.6)
    expect(computeBounds([rect])).toEqual(rect)
  })

  test('keeps legacy canvas world-transform helpers usable', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', firstPageId(graph), {
      x: 10,
      y: 20,
      width: 30,
      height: 40
    })

    expect(getAbsoluteRotation(rect, graph)).toBe(0)
    expect(getWorldHandles(rect, graph).se).toEqual({ x: 40, y: 60 })
    expect(getAbsolutePositionFull(rect, graph)).toMatchObject({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0,
      centerX: 25,
      centerY: 40
    })
  })
})
