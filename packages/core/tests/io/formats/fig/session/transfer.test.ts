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
