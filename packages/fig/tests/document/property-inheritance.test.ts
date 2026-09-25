import { expect, test } from 'bun:test'

import { createDocumentReader } from '#fig/document/read'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { guid } from '../helpers/guid'

test('inherits parent definition semantics without replacing local property identity', () => {
  const changes = [
    {
      guid: guid(1),
      type: 'FRAME',
      isStateGroup: true,
      componentPropDefs: [
        { id: guid(10), name: 'Icon', type: 'INSTANCE_SWAP', initialValue: { guidValue: guid(4) } }
      ]
    },
    {
      guid: guid(2),
      type: 'SYMBOL',
      parentIndex: { guid: guid(1), position: '!' },
      componentPropDefs: [{ id: guid(11), parentPropDefId: guid(10) }]
    },
    {
      guid: guid(3),
      type: 'INSTANCE',
      parentIndex: { guid: guid(2), position: '!' },
      symbolData: { symbolID: guid(4) },
      componentPropRefs: [{ defID: guid(11), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
    },
    { guid: guid(4), type: 'SYMBOL', name: 'Default' },
    { guid: guid(5), type: 'SYMBOL', name: 'Replacement' },
    { guid: guid(6), type: 'CANVAS' },
    {
      guid: guid(7),
      type: 'INSTANCE',
      parentIndex: { guid: guid(6), position: '!' },
      symbolData: { symbolID: guid(2) },
      componentPropAssignments: [{ defID: guid(11), value: { guidValue: guid(5) } }]
    }
  ] as NodeChange[]
  const before = structuredClone(changes)
  const reader = createDocumentReader(changes)
  const component = reader.readComponent('1:2')
  expect(component.properties.componentPropDefs).toEqual([
    {
      id: guid(11),
      parentPropDefId: guid(10),
      name: 'Icon',
      type: 'INSTANCE_SWAP',
      initialValue: { guidValue: guid(4) }
    }
  ])
  expect(component.children[0].mainComponentId).toBe('1:4')
  expect(reader.readPage('1:6').children[0].children[0].mainComponentId).toBe('1:5')
  expect(changes).toEqual(before)
})
