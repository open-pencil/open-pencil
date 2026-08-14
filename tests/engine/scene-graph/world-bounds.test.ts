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

    expect(getAxisAlignedWorldBounds(node, graph)).toEqual({
      x: 125,
      y: 75,
      width: 50,
      height: 100
    })
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

    expect(getAxisAlignedWorldBounds(child, graph)).toEqual({
      x: 250,
      y: 120,
      width: 20,
      height: 40
    })
  })
})
