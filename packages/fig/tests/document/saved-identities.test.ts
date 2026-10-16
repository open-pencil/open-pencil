import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { materializeDocument } from '#fig/document/materialize'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

test('component definitions retain saved identities without assigning them to instance copies', () => {
  const records: NodeChange[] = [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
    {
      guid: guid(3),
      type: 'FRAME',
      isStateGroup: true,
      parentIndex: { guid: guid(2), position: '!' }
    },
    {
      guid: guid(4),
      type: 'SYMBOL',
      name: 'Same label',
      parentIndex: { guid: guid(3), position: '!' }
    },
    {
      guid: guid(5),
      type: 'RECTANGLE',
      name: 'Child',
      parentIndex: { guid: guid(4), position: '!' }
    },
    {
      guid: guid(6),
      type: 'SYMBOL',
      name: 'Same label',
      parentIndex: { guid: guid(3), position: '"' }
    },
    {
      guid: guid(7),
      type: 'INSTANCE',
      parentIndex: { guid: guid(2), position: '"' },
      symbolData: { symbolID: guid(4) }
    }
  ]
  const { graph, sources } = materializeDocument(records)
  for (const id of ['1:3', '1:4', '1:5', '1:6']) {
    const node = graph.getNode(sources.get(id) ?? '')
    expect(node?.source.id).toBe(id)
    expect([...graph.getAllNodes()].filter((candidate) => candidate.source.id === id)).toHaveLength(
      1
    )
  }
  const instance = graph.getNode(sources.get('1:7') ?? '')
  const componentId = sources.get('1:4')
  const childId = sources.get('1:5')
  if (!instance || !componentId || !childId) throw new Error('Missing component or instance')
  expect(instance.componentId).toBe(componentId)
  const [copy] = graph.getChildren(instance.id)
  expect(copy.name).toBe('Child')
  expect(copy.source.id).toBeNull()
  expect(copy.id).not.toBe(childId)
})
