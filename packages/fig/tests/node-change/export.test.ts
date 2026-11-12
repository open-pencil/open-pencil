import { describe, expect, test } from 'bun:test'

import { mapToFigmaType, sceneNodeToKiwi } from '#fig/node-change/index'

import { SceneGraph } from '@open-pencil/scene-graph'
import { fractionalPosition } from '@open-pencil/scene-graph/order-keys'

describe('@open-pencil/fig SceneGraph export policy', () => {
  test('maps node types deterministically', () => {
    expect(mapToFigmaType('COMPONENT')).toBe('SYMBOL')
  })

  test('exports one ordering scheme when preserved and generated siblings are mixed', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id)
    node.source.orderKey = 'z'
    const change = sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    expect(change[0]?.parentIndex?.position).toBe(fractionalPosition(0))
  })
})

function expectStrictlyIncreasing(keys: string[]) {
  for (let i = 1; i < keys.length; i++) expect(keys[i] > keys[i - 1]).toBe(true)
}

describe('Figma export order keys', () => {
  test('a layer added before imported siblings does not share their keys', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { name: 'Frame' })
    for (const [name, orderKey] of [
      ['A', '!'],
      ['B', '"'],
      ['C', '#']
    ]) {
      const child = graph.createNode('RECTANGLE', frame.id, { name })
      child.source.orderKey = orderKey
    }
    const inserted = graph.createNode('RECTANGLE', frame.id, { name: 'Inserted' })
    frame.childIds = [inserted.id, ...frame.childIds.filter((id) => id !== inserted.id)]

    const changes = sceneNodeToKiwi(frame, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])
    const children = changes.slice(1)
    const positions = children.map((change) => change.parentIndex?.position ?? '')

    expect(children.map((change) => change.name)).toEqual(['Inserted', 'A', 'B', 'C'])
    // Nothing sorts before '!', so A is re-keyed; B and C keep their imported keys.
    expect(positions.slice(2)).toEqual(['"', '#'])
    expect(new Set(positions).size).toBe(4)
    expectStrictlyIncreasing(positions)
  })
})
