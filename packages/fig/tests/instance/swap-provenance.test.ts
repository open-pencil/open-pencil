import { expect, test } from 'bun:test'

import { interpretInstance, resolveOccurrencePath } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const guid = (localID: number) => ({ sessionID: 1, localID })

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
