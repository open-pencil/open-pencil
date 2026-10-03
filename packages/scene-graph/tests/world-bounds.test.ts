import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  getAxisAlignedBoundsInParent,
  getAxisAlignedWorldBounds
} from '@open-pencil/scene-graph/coordinate'

describe('axis-aligned world bounds', () => {
  test('includes a node own rotation', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      x: 100,
      y: 100,
      width: 100,
      height: 50,
      rotation: 90
    })

    const bounds = getAxisAlignedWorldBounds(node, graph)
    expect(bounds.x).toBeCloseTo(125, 10)
    expect(bounds.y).toBeCloseTo(75, 10)
    expect(bounds.width).toBeCloseTo(50, 10)
    expect(bounds.height).toBeCloseTo(100, 10)
  })

  test('includes transformed ancestors', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      rotation: 90
    })
    const child = graph.createNode('RECTANGLE', frame.id, {
      x: 20,
      y: 30,
      width: 40,
      height: 20
    })

    // Equivalent pivot compositions can differ by a few floating-point ULPs.
    const bounds = getAxisAlignedWorldBounds(child, graph)
    expect(bounds.x).toBeCloseTo(250, 10)
    expect(bounds.y).toBeCloseTo(120, 10)
    expect(bounds.width).toBeCloseTo(20, 10)
    expect(bounds.height).toBeCloseTo(40, 10)
  })
})

describe('axis-aligned bounds in a parent', () => {
  function twoRectangles(graph: SceneGraph, parentId: string) {
    return [
      graph.createNode('RECTANGLE', parentId, { x: 10, y: 20, width: 30, height: 30 }),
      graph.createNode('RECTANGLE', parentId, { x: 60, y: 70, width: 20, height: 20 })
    ]
  }

  test('spans the nodes in an unrotated parent', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { x: 100, y: 200, width: 300, height: 300 })
    const nodes = twoRectangles(graph, frame.id)

    expect(getAxisAlignedBoundsInParent(nodes, frame.id, graph)).toEqual({
      x: 10,
      y: 20,
      width: 70,
      height: 70
    })
    expect(getAxisAlignedBoundsInParent(nodes, page.id, graph)).toEqual({
      x: 110,
      y: 220,
      width: 70,
      height: 70
    })
  })

  test('measures in the axes of a rotated parent', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      x: 100,
      y: 200,
      width: 300,
      height: 300,
      rotation: 90
    })
    const nodes = twoRectangles(graph, frame.id)

    const bounds = getAxisAlignedBoundsInParent(nodes, frame.id, graph)
    expect(bounds.x).toBeCloseTo(10, 6)
    expect(bounds.y).toBeCloseTo(20, 6)
    expect(bounds.width).toBeCloseTo(70, 6)
    expect(bounds.height).toBeCloseTo(70, 6)
  })

  test('accounts for a rotated node and a flipped parent', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      flipX: true
    })
    const node = graph.createNode('RECTANGLE', frame.id, {
      x: 50,
      y: 25,
      width: 100,
      height: 50,
      rotation: 90
    })

    const bounds = getAxisAlignedBoundsInParent([node], frame.id, graph)
    expect(bounds.x).toBeCloseTo(75, 6)
    expect(bounds.y).toBeCloseTo(0, 6)
    expect(bounds.width).toBeCloseTo(50, 6)
    expect(bounds.height).toBeCloseTo(100, 6)
    expect(getAxisAlignedBoundsInParent([], frame.id, graph)).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0
    })
  })
})
