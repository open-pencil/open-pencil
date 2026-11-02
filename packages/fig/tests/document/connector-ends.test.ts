import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { materializeDocument } from '#fig/document/materialize'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

test('a connector binds to an instance read in the same pass', () => {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', name: 'Page', parentIndex: { guid: guid(1), position: 'a' } },
    { guid: guid(4), type: 'SYMBOL', name: 'Card', parentIndex: { guid: guid(2), position: 'a' } },
    {
      guid: guid(6),
      type: 'INSTANCE',
      parentIndex: { guid: guid(2), position: 'b' },
      symbolData: { symbolID: guid(4) }
    },
    { guid: guid(7), type: 'RECTANGLE', parentIndex: { guid: guid(2), position: 'c' } },
    {
      guid: guid(8),
      type: 'CONNECTOR',
      parentIndex: { guid: guid(2), position: 'd' },
      connectorStart: { endpointNodeID: guid(6), magnet: 'AUTO' },
      connectorEnd: { endpointNodeID: guid(7), magnet: 'LEFT' }
    }
  ]
  const { graph, sources } = materializeDocument(changes)
  const connector = graph.getNode(sources.get('1:8') ?? '')
  expect(connector?.connectorStart).toMatchObject({ nodeId: sources.get('1:6'), magnet: 'AUTO' })
  expect(connector?.connectorEnd).toMatchObject({ nodeId: sources.get('1:7'), magnet: 'LEFT' })
})
