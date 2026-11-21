import { expect, test } from 'bun:test'

import { materializeDocument } from '#fig/document/materialize'
import { createDocumentReader } from '#fig/document/read'
import { createResourceResolver } from '#fig/document/resource-reference'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guid } from '@open-pencil/test-support/fig/guid'

test('copies archive images into document-owned resources', () => {
  const bytes = new Uint8Array([1, 2, 3])
  const { graph } = materializeDocument([], [], { images: new Map([['image-hash', bytes]]) })
  expect(graph.images.get('image-hash')).toEqual(bytes)
  bytes[0] = 9
  expect(graph.images.get('image-hash')?.[0]).toBe(1)
})

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

test('opens a variable with a value for a mode its collection no longer lists, without it', () => {
  const kept = guid(10)
  const gone = guid(11)
  const collection = guid(3)
  const value = (floatValue: number) => ({ dataType: 'FLOAT' as const, value: { floatValue } })
  const resources: NodeChange[] = [
    { guid: collection, type: 'VARIABLE_SET', variableSetModes: [{ id: kept, name: 'Default' }] },
    {
      guid: guid(4),
      type: 'VARIABLE',
      variableResolvedType: 'FLOAT',
      variableSetID: { guid: collection },
      variableDataValues: {
        entries: [
          { modeID: gone, variableData: value(1) },
          { modeID: kept, variableData: value(2) }
        ]
      }
    }
  ]
  const { graph } = materializeDocument(resources)
  expect(graph.variables.get('1:4')?.valuesByMode).toEqual({ '1:10': 2 })
})

/** A Brand collection with Light and Dark, and a variable whose values were saved for `saved`. */
function savedForOtherModes(saved: { id: ReturnType<typeof guid>; name: string }[]) {
  const value = (floatValue: number) => ({ dataType: 'FLOAT' as const, value: { floatValue } })
  const resources: NodeChange[] = [
    {
      guid: guid(3),
      type: 'VARIABLE_SET',
      variableSetModes: [
        { id: guid(10), name: 'Light' },
        { id: guid(11), name: 'Dark' }
      ]
    },
    { guid: guid(5), type: 'VARIABLE_SET', variableSetModes: saved },
    {
      guid: guid(4),
      type: 'VARIABLE',
      variableResolvedType: 'FLOAT',
      variableSetID: { guid: guid(3) },
      variableDataValues: {
        entries: saved.map((mode, index) => ({ modeID: mode.id, variableData: value(index + 1) }))
      }
    }
  ]
  return materializeDocument(resources).graph.variables.get('1:4')?.valuesByMode
}

test('opens values saved for another collection in its modes of the same name', () => {
  const values = savedForOtherModes([
    { id: guid(20), name: 'Dark' },
    { id: guid(21), name: 'Light' }
  ])
  expect(values).toEqual({ '1:11': 1, '1:10': 2 })
})

test('keeps the first value in the default mode when no saved mode matches', () => {
  expect(savedForOtherModes([{ id: guid(20), name: 'Mode 1' }])).toEqual({ '1:10': 1 })
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

test('an explicit unversioned record wins regardless of source ordering', () => {
  const entries: NodeChange[] = [
    { guid: { sessionID: 1, localID: 1 }, key: 'style' },
    { guid: { sessionID: 1, localID: 2 }, key: 'style', version: 'v2' }
  ]
  for (const records of [entries, entries.toReversed()]) {
    const resolve = createResourceResolver(records)
    expect(resolve({ assetRef: { key: 'style' } })).toBe('1:1')
    expect(resolve({ assetRef: { key: 'style', version: 'v2' } })).toBe('1:2')
    expect(resolve({ assetRef: { key: 'style', version: 'missing' } })).toBeUndefined()
  }
})

test('resolves exact resource versions and refuses ambiguous unversioned references', () => {
  const resolve = createResourceResolver([
    { guid: { sessionID: 1, localID: 1 }, key: 'collection', version: 'v1' },
    { guid: { sessionID: 1, localID: 2 }, key: 'collection', version: 'v2' }
  ] as NodeChange[])
  expect(resolve({ assetRef: { key: 'collection', version: 'v2' } })).toBe('1:2')
  expect(resolve({ assetRef: { key: 'collection', version: 'missing' } })).toBeUndefined()
  expect(resolve({ assetRef: { key: 'collection' } })).toBeUndefined()
  expect(resolve({ guid: { sessionID: 2, localID: 3 } })).toBe('2:3')
})
