import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const DOCUMENT = { sessionID: 0, localID: 0 }

test('layers are created under their records’ GUIDs, and copies in instances under ids of their own', () => {
  const changes: NodeChange[] = [
    { guid: DOCUMENT, type: 'DOCUMENT' },
    {
      guid: guid(1),
      type: 'CANVAS',
      name: 'Design',
      parentIndex: { guid: DOCUMENT, position: '!' }
    },
    { guid: guid(2), type: 'SYMBOL', parentIndex: { guid: guid(1), position: '!' } },
    {
      guid: guid(3),
      type: 'TEXT',
      parentIndex: { guid: guid(2), position: '!' },
      textData: { characters: 'Label' }
    },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '"' },
      symbolData: { symbolID: guid(2) }
    }
  ]
  const { graph } = materializeDocument(changes)
  expect(graph.rootId).toBe('0:0')
  expect(graph.getPages().map((page) => page.id)).toEqual(['1:1'])
  expect(graph.getNode('1:2')?.type).toBe('COMPONENT')
  expect(graph.getNode('1:3')?.parentId).toBe('1:2')
  expect(graph.getNode('1:4')?.componentId).toBe('1:2')
  const [copy] = graph.getChildren('1:4')
  expect(copy.text).toBe('Label')
  expect(copy.id).not.toBe('1:3')
})

test('ids the import mints skip the GUIDs of pages it has not read', () => {
  // The unread page's records sit where the import counts from, in session 0.
  const unread = [
    { sessionID: 0, localID: 1 },
    { sessionID: 0, localID: 2 },
    { sessionID: 0, localID: 3 },
    { sessionID: 0, localID: 4 }
  ]
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'CANVAS', name: 'Design' },
    { guid: guid(2), type: 'SYMBOL', parentIndex: { guid: guid(1), position: '!' } },
    {
      guid: guid(3),
      type: 'TEXT',
      parentIndex: { guid: guid(2), position: '!' },
      textData: { characters: 'Label' }
    },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '"' },
      symbolData: { symbolID: guid(2) }
    },
    { guid: unread[0], type: 'CANVAS', name: 'Later' },
    ...unread.slice(1).map((id, index): NodeChange => ({
      guid: id,
      type: 'RECTANGLE',
      parentIndex: { guid: unread[0], position: String.fromCharCode(33 + index) }
    }))
  ]
  const { graph } = materializeDocument(changes, [], { pageIds: new Set(['1:1']) })
  expect(graph.getNode('0:1')?.name).toBe('Later')
  expect(graph.getChildren('1:4')).toHaveLength(1)
  for (const { localID } of unread.slice(1)) expect(graph.getNode(`0:${localID}`)).toBeUndefined()
})
