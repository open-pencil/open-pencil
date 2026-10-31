import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { createConnector, freeEndpoint } from '@open-pencil/scene-graph/connectors'

import { deserializeSceneGraph, serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'

test('a graph sent from the reader keeps its connectors indexed for routing', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const connector = createConnector(graph, page, {
    start: freeEndpoint(0, 0),
    end: freeEndpoint(100, 0)
  })
  const received = deserializeSceneGraph(structuredClone(serializeSceneGraph(graph)))
  expect([...received.connectorIds]).toEqual([connector.id])
})

test('a graph received from the parse worker is repaired when its child lists form a cycle', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const outer = graph.createNode('FRAME', page.id, { name: 'Outer' })
  const inner = graph.createNode('FRAME', outer.id, { name: 'Inner' })
  inner.childIds = [outer.id]

  const received = deserializeSceneGraph(serializeSceneGraph(graph))

  expect(received.getNode(inner.id)?.childIds).toEqual([])
  expect(received.getNode(inner.id)?.parentId).toBe(outer.id)
  expect(received.getChildren(outer.id).map((node) => node.id)).toEqual([inner.id])
})
