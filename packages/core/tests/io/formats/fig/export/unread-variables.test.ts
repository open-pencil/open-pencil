import { expect, test } from 'bun:test'

import { figArchiveRecordInfo } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph } from '@open-pencil/scene-graph'
import { guid } from '@open-pencil/test-support/fig/guid'

import { appendVariableNodeChanges } from '#core/io/formats/fig/export/variables'

/** A PAINT variable as Figma writes it; the pinned schema has no PAINT type or paint values. */
function paintVariable(localID: number, collectionId: string): NodeChange {
  const value = { paintValue: { type: 'SOLID' } }
  return {
    guid: guid(localID),
    type: 'VARIABLE',
    name: `Paint ${localID}`,
    isSoftDeleted: true,
    parentIndex: { guid: guid(1), position: 'saved' },
    variableSetID: { guid: stringToGuid(collectionId) },
    ...({
      variableResolvedType: 'PAINT',
      variableDataValues: {
        entries: [{ modeID: guid(10), variableData: { value } }]
      }
    } as Partial<NodeChange>)
  }
}

test('the archive names the variable records the reader leaves out', () => {
  const color: NodeChange = { guid: guid(4), type: 'VARIABLE', variableResolvedType: 'COLOR' }
  const paint = paintVariable(5, '1:3')
  const info = figArchiveRecordInfo({
    records: [{ guid: guid(4), type: 'VARIABLE' }],
    resources: [{ guid: guid(3), type: 'VARIABLE_SET' }, color, paint],
    blobCount: 0,
    imageHashes: []
  })
  expect(info.unreadVariables).toEqual([paint])
})

test('a save writes unread variables back after the rest, unless their collection is gone', () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Color Scheme')
  graph.createVariable('Accent', 'COLOR', collection.id)
  const kept = paintVariable(5, collection.id)
  const orphaned = paintVariable(6, '9:9')
  const changes: NodeChange[] = []
  let position = 0
  appendVariableNodeChanges(graph, changes, guid(2), new Map(), new Map(), () => `${position++}`, [
    kept,
    orphaned
  ])
  expect(changes.map((change) => change.name)).toEqual(['Color Scheme', 'Accent', 'Paint 5'])
  expect(changes[2]).toEqual({ ...kept, parentIndex: { guid: guid(2), position: '2' } })
})
