import { expect, test } from 'bun:test'

import { materializeDocument } from '#fig/document/materialize'
import { createDocumentReader } from '#fig/document/read'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const guid = (localID: number) => ({ sessionID: 1, localID })

test('loads mode values without treating false, zero or empty text as missing', () => {
  const mode = guid(10)
  const collection = guid(3)
  const resources: NodeChange[] = [
    { guid: collection, type: 'VARIABLE_SET', variableSetModes: [{ id: mode, name: 'Default' }] },
    ...(['BOOLEAN', 'FLOAT', 'STRING'] as const).map((type, index) => ({
      guid: guid(4 + index),
      type: 'VARIABLE' as const,
      variableResolvedType: type,
      variableSetID: { guid: collection },
      variableDataValues: {
        entries: [
          {
            modeID: mode,
            variableData: {
              dataType: type,
              value: {
                BOOLEAN: { boolValue: false },
                FLOAT: { floatValue: 0 },
                STRING: { textValue: '' }
              }[type]
            }
          }
        ]
      }
    }))
  ]
  const { graph } = materializeDocument(resources)
  expect([...graph.variables.values()].map((variable) => variable.valuesByMode['1:10'])).toEqual([
    false,
    0,
    ''
  ])
  expect(graph.variableCollections.get('1:3')?.variableIds).toEqual(['1:4', '1:5', '1:6'])
})

test('keeps variable resources outside scene pages and rejects silent omission', () => {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
    { guid: guid(3), type: 'VARIABLE_SET', parentIndex: { guid: guid(2), position: '!' } },
    { guid: guid(4), type: 'VARIABLE', parentIndex: { guid: guid(3), position: '!' } }
  ]
  const reader = createDocumentReader(changes)
  expect(reader.resources.map((node) => node.type)).toEqual(['VARIABLE_SET', 'VARIABLE'])
  expect(reader.readPage('1:2').children).toEqual([])
  expect(() => materializeDocument(changes)).toThrow('Unsupported document resource')
  const reported: NodeChange[] = []
  const { graph } = materializeDocument(changes, [], {
    onUnsupportedResource: (node) => reported.push(node)
  })
  expect(reported).toHaveLength(2)
  expect(graph.getChildren(graph.getPages()[0].id)).toEqual([])
})
