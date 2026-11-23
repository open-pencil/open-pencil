import { expect, test } from 'bun:test'

import type { FigUnreadVariable } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph } from '@open-pencil/scene-graph'
import { guid } from '@open-pencil/test-support/fig/guid'

import { appendVariableNodeChanges } from '#core/io/formats/fig/export/variables'

/** A PAINT variable as Figma writes it; the pinned schema has no PAINT type or paint values. */
function paintVariable(localID: number, extra: Partial<NodeChange> = {}): NodeChange {
  const value = { paintValue: { type: 'SOLID' } }
  return {
    guid: guid(localID),
    type: 'VARIABLE',
    name: `Paint ${localID}`,
    isSoftDeleted: true,
    parentIndex: { guid: guid(1), position: 'saved' },
    ...extra,
    ...({
      variableResolvedType: 'PAINT',
      variableDataValues: {
        entries: [{ modeID: guid(10), variableData: { value } }]
      }
    } as Partial<NodeChange>)
  }
}

/** The records a save writes for one collection and its variable, then `unread`. */
function written(unread: (collectionId: string) => FigUnreadVariable[]) {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Color Scheme')
  graph.createVariable('Accent', 'COLOR', collection.id)
  const changes: NodeChange[] = []
  let position = 0
  appendVariableNodeChanges(
    graph,
    changes,
    guid(2),
    new Map(),
    new Map(),
    () => `${position++}`,
    unread(collection.id)
  )
  return changes
}

test('a save writes unread variables back after the rest, unless their collection is gone', () => {
  const records: NodeChange[] = []
  const changes = written((collectionId) => {
    records.push(paintVariable(5, { variableSetID: { guid: stringToGuid(collectionId) } }))
    return [
      { record: records[0], collectionId },
      {
        record: paintVariable(6, { variableSetID: { guid: guid(9) } }),
        collectionId: '1:9'
      }
    ]
  })
  expect(changes.map((change) => change.name)).toEqual(['Color Scheme', 'Accent', 'Paint 5'])
  expect(changes[2]).toEqual({
    ...records[0],
    parentIndex: { guid: guid(2), position: '2' }
  })
})

test('an unread variable that names its collection as its parent keeps naming it', () => {
  const changes = written((collectionId) => [
    {
      record: paintVariable(5, {
        parentIndex: { guid: stringToGuid(collectionId), position: '0' }
      }),
      collectionId
    }
  ])
  expect(changes[2].variableSetID).toEqual({ guid: changes[0].guid })
  expect(changes[2].parentIndex?.guid).toEqual(guid(2))
})

test('an unread variable whose collection the file never held is written as it was', () => {
  const record = paintVariable(5, {
    variableSetID: { assetRef: { key: 'lib', version: '1' } }
  })
  const changes = written(() => [{ record }])
  expect(changes[2]).toEqual({
    ...record,
    parentIndex: { guid: guid(2), position: '2' }
  })
})
