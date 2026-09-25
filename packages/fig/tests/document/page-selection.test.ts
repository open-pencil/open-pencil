import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { guid } from '../helpers/guid'

test('selected-page assembly excludes unrelated content but keeps cross-page components', () => {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'CANVAS', name: 'Design' },
    { guid: guid(2), type: 'CANVAS', name: 'Library' },
    { guid: guid(3), type: 'SYMBOL', parentIndex: { guid: guid(2), position: '!' } },
    {
      guid: guid(4),
      type: 'TEXT',
      parentIndex: { guid: guid(3), position: '!' },
      textData: { characters: 'Shared' }
    },
    {
      guid: guid(5),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '!' },
      symbolData: { symbolID: guid(3) }
    },
    {
      guid: guid(6),
      type: 'TEXT',
      parentIndex: { guid: guid(2), position: '"' },
      textData: { characters: 'Unrelated' }
    }
  ]
  const selected = materializeDocument(changes, [], { pageIds: new Set(['1:1']) })
  const full = materializeDocument(changes)
  expect(selected.graph.getPages()).toHaveLength(2)
  expect(selected.sources.has('1:6')).toBe(false)
  expect(full.sources.has('1:6')).toBe(true)
  const id = selected.sources.get('1:5')
  if (!id) throw new Error('Missing selected instance')
  expect(selected.graph.getChildren(id)[0].text).toBe('Shared')
  expect(() => materializeDocument(changes, [], { pageIds: new Set(['missing']) })).toThrow(
    'Unknown page'
  )
})
