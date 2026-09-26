import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { interpretInstance, resolveOccurrencePath } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

test('a saved swap applies replacement bindings before explicit root and child claims', () => {
  const property = guid(90)
  const changes = [
    { guid: guid(1), type: 'SYMBOL' },
    {
      guid: guid(3),
      type: 'SYMBOL',
      opacity: 1,
      componentPropDefs: [
        { id: property, name: 'Label', type: 'TEXT', initialValue: { textValue: 'Default' } }
      ]
    },
    {
      guid: guid(4),
      type: 'TEXT',
      parentIndex: { guid: guid(3), position: '!' },
      textData: { characters: 'Default' },
      componentPropRefs: [{ defID: property, componentPropNodeField: 'TEXT_DATA' }]
    },
    { guid: guid(5), type: 'SYMBOL' },
    {
      guid: guid(6),
      type: 'INSTANCE',
      parentIndex: { guid: guid(5), position: '!' },
      symbolData: { symbolID: guid(1) }
    },
    {
      guid: guid(8),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(5),
        symbolOverrides: [
          {
            guidPath: { guids: [guid(6)] },
            overriddenSymbolID: guid(3),
            componentPropAssignments: [{ defID: property, value: { textValue: 'Assigned' } }],
            opacity: 0.4
          },
          { guidPath: { guids: [guid(6), guid(4)] }, textData: { characters: 'Explicit' } }
        ]
      }
    }
  ] as NodeChange[]
  const result = interpretInstance(changes, '1:8')
  const swapped = result.children[0]
  expect(swapped.mainComponentId).toBe('1:3')
  expect(swapped.properties.opacity).toBe(0.4)
  expect(swapped.children[0].properties.textData?.characters).toBe('Explicit')
  expect(swapped.children[0].bindingClaims).toEqual([
    { definitionId: property, field: 'textData', origin: 'assignment' }
  ])
  expect(result.propertyClaims).toEqual([
    { declaredBy: '1:8', path: [guid(6)], properties: { opacity: 0.4 } },
    {
      declaredBy: '1:8',
      path: [guid(6), guid(4)],
      properties: { textData: { characters: 'Explicit' } }
    }
  ])
  for (const claim of result.propertyClaims) {
    expect(() => resolveOccurrencePath(result, claim.path)).not.toThrow()
  }
})

test('an outer swap retires inherited claims against removed descendants', () => {
  const changes = [
    { guid: guid(1), type: 'SYMBOL' },
    {
      guid: guid(2),
      type: 'TEXT',
      parentIndex: { guid: guid(1), position: '!' },
      textData: { characters: 'Original' }
    },
    { guid: guid(3), type: 'SYMBOL' },
    {
      guid: guid(4),
      type: 'TEXT',
      parentIndex: { guid: guid(3), position: '!' },
      textData: { characters: 'Replacement' }
    },
    { guid: guid(5), type: 'SYMBOL' },
    {
      guid: guid(6),
      type: 'INSTANCE',
      parentIndex: { guid: guid(5), position: '!' },
      symbolData: { symbolID: guid(1) }
    },
    {
      guid: guid(7),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(5),
        symbolOverrides: [
          { guidPath: { guids: [guid(6), guid(2)] }, textData: { characters: 'Old explicit' } }
        ]
      }
    },
    {
      guid: guid(8),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(7),
        symbolOverrides: [{ guidPath: { guids: [guid(6)] }, overriddenSymbolID: guid(3) }]
      }
    }
  ] as NodeChange[]
  const result = interpretInstance(changes, '1:8')
  expect(result.children[0].children[0].properties.textData?.characters).toBe('Replacement')
  expect(result.propertyClaims).toEqual([])
  for (const claim of result.propertyClaims)
    expect(() => resolveOccurrencePath(result, claim.path)).not.toThrow()
  expect(interpretInstance(changes, '1:7').propertyClaims).toHaveLength(1)
})

// material3 List: an outer owner swaps a list item to another variant, and the item's own
// saved swap of a trailing checkbox still addresses the original variant's child.
test('an outer swap retires an inherited nested swap against the replaced component', () => {
  const changes = [
    { guid: guid(1), type: 'SYMBOL', name: 'Checkbox' },
    { guid: guid(2), type: 'SYMBOL', name: 'Switch' },
    { guid: guid(10), type: 'SYMBOL', name: 'Item with checkbox' },
    { guid: guid(11), type: 'FRAME', parentIndex: { guid: guid(10), position: '!' } },
    {
      guid: guid(12),
      type: 'INSTANCE',
      parentIndex: { guid: guid(11), position: '!' },
      symbolData: { symbolID: guid(1) }
    },
    { guid: guid(20), type: 'SYMBOL', name: 'Item without checkbox' },
    {
      guid: guid(21),
      type: 'TEXT',
      parentIndex: { guid: guid(20), position: '!' },
      textData: { characters: 'Plain' }
    },
    { guid: guid(30), type: 'SYMBOL', name: 'List' },
    {
      guid: guid(31),
      type: 'INSTANCE',
      parentIndex: { guid: guid(30), position: '!' },
      symbolData: {
        symbolID: guid(10),
        symbolOverrides: [{ guidPath: { guids: [guid(12)] }, overriddenSymbolID: guid(2) }]
      }
    },
    {
      guid: guid(40),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(30),
        symbolOverrides: [{ guidPath: { guids: [guid(31)] }, overriddenSymbolID: guid(20) }]
      }
    }
  ] as NodeChange[]
  const item = interpretInstance(changes, '1:40').children[0]
  expect(item.mainComponentId).toBe('1:20')
  expect(item.children[0].properties.textData?.characters).toBe('Plain')
  // Without the outer swap the nested swap still applies.
  expect(interpretInstance(changes, '1:31').children[0].children[0].mainComponentId).toBe('1:2')
  // A nested swap that never resolved anywhere remains an error.
  const broken = structuredClone(changes)
  const inner = broken.find((node) => node.guid?.localID === 31)
  if (!inner?.symbolData) throw new Error('Missing inner instance')
  inner.symbolData = {
    symbolID: guid(10),
    symbolOverrides: [{ guidPath: { guids: [guid(99)] }, overriddenSymbolID: guid(2) }]
  } as NodeChange['symbolData']
  expect(() => interpretInstance(broken, '1:40')).toThrow('found 0')
})
