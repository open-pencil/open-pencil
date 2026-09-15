import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'

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
