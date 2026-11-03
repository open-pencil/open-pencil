import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import { scaleNodeChanges } from '@open-pencil/scene-graph/scaling'

const pattern: Fill = {
  type: 'PATTERN',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  scale: 1,
  patternSpacing: { x: 4, y: 6 }
}

describe('scaling a vector', () => {
  test("scales a region's own paints as it scales the layer's", () => {
    const graph = new SceneGraph()
    const vector = graph.createNode('VECTOR', graph.getPages()[0].id, {
      width: 10,
      height: 10,
      fills: [pattern],
      vectorNetwork: {
        vertices: [{ x: 0, y: 0 }],
        segments: [],
        regions: [{ windingRule: 'NONZERO', loops: [], fills: [pattern] }]
      }
    })
    const changes = scaleNodeChanges(vector, 2, false)
    const [region] = changes.vectorNetwork?.regions ?? []
    expect(region?.fills).toEqual(changes.fills)
    expect(region?.fills?.[0]).toMatchObject({ scale: 2, patternSpacing: { x: 8, y: 12 } })
  })
})
