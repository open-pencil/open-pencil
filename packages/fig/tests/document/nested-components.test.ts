import { expect, test } from 'bun:test'

import { materializeDocument } from '#fig/document/materialize'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const guid = (localID: number) => ({ sessionID: 1, localID })

test('constructs nested definitions once under their actual component parent', () => {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
    { guid: guid(3), type: 'SYMBOL', parentIndex: { guid: guid(2), position: 'a' } },
    { guid: guid(4), type: 'SYMBOL', parentIndex: { guid: guid(3), position: 'a' } },
    {
      guid: guid(5),
      type: 'TEXT',
      parentIndex: { guid: guid(4), position: 'a' },
      textData: { characters: 'Nested' }
    },
    {
      guid: guid(6),
      type: 'INSTANCE',
      parentIndex: { guid: guid(2), position: 'b' },
      symbolData: { symbolID: guid(4) }
    }
  ]
  const { graph, sources } = materializeDocument(changes)
  const outer = sources.get('1:3')
  const inner = sources.get('1:4')
  const instance = sources.get('1:6')
  if (!outer || !inner || !instance) throw new Error('Missing nodes')
  expect(graph.getNode(inner)?.parentId).toBe(outer)
  expect(graph.getNode(instance)?.componentId).toBe(inner)
  expect([...graph.getAllNodes()].filter((node) => node.type === 'COMPONENT')).toHaveLength(2)
})
