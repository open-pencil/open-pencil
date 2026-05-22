import { describe, expect, test } from 'bun:test'

import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'
import { SceneGraph } from '#core/scene-graph'

describe('Figma boolean operation export', () => {
  test('exports boolean operation node type and operation', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('BOOLEAN_OPERATION', page.id, {
      booleanOperation: 'INTERSECT'
    })

    const changes = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])

    expect(changes[0].type).toBe('BOOLEAN_OPERATION')
    expect(changes[0].booleanOperation).toBe('INTERSECT')
  })
})
