import { describe, expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '#fig/node-change/index'

import { SceneGraph } from '@open-pencil/scene-graph'

const zero = { x: 0, y: 0 }

describe('Figma stroke join', () => {
  // A vector's points without a join of their own take the layer's; without one on the layer,
  // Figma reports none for them and rejects the network when it is written back.
  test('is written on every layer, the default MITER too', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const vector = graph.createNode('VECTOR', pageId, {
      width: 10,
      height: 10,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 10 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: zero, tangentEnd: zero }],
        regions: []
      }
    })
    const frame = graph.createNode('FRAME', pageId, { strokeJoin: 'ROUND' })

    for (const [node, join] of [
      [vector, 'MITER'],
      [frame, 'ROUND']
    ] as const) {
      const [change] = sceneNodeToKiwi(
        node,
        { sessionID: 1, localID: 0 },
        0,
        { value: 2 },
        graph,
        []
      )
      expect(change.strokeJoin).toBe(join)
    }
  })
})
