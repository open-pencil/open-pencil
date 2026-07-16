import { describe, expect, test } from 'bun:test'

import { createNodeChangesMessage, encodeMessage, initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import { sceneNodeToKiwi } from '#core/kiwi/fig/node-change/serialize'

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

  test('normalizes EXCLUDE to XOR (Figma compatibility)', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('BOOLEAN_OPERATION', page.id, {
      booleanOperation: 'EXCLUDE'
    })

    const changes = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])

    expect(changes[0].type).toBe('BOOLEAN_OPERATION')
    expect(changes[0].booleanOperation).toBe('XOR')

    await initCodec()
    expect(() => encodeMessage(createNodeChangesMessage(1, 1, changes))).not.toThrow()
  })

  test('normalizes UNION as default when booleanOperation is undefined', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('BOOLEAN_OPERATION', page.id, {})

    const changes = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])

    expect(changes[0].type).toBe('BOOLEAN_OPERATION')
    expect(changes[0].booleanOperation).toBe('UNION')
  })

  test('exports boolean operation children in order', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('BOOLEAN_OPERATION', page.id, {
      booleanOperation: 'SUBTRACT'
    })
    graph.createNode('RECTANGLE', node.id, { name: 'Left operand' })
    graph.createNode('ELLIPSE', node.id, { name: 'Right operand' })

    const changes = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])

    expect(changes.map((change) => change.type)).toEqual([
      'BOOLEAN_OPERATION',
      'RECTANGLE',
      'ELLIPSE'
    ])
    expect(changes.map((change) => change.parentIndex?.position)).toEqual(['!', '!', '"'])
  })
})
