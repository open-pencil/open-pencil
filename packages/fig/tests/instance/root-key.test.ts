import { expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { guid } from '../helpers/guid'

test('explicit swaps preserve references owned by the enclosing component', () => {
  const refs = [{ defID: guid(80), componentPropNodeField: 'VISIBLE' }]
  const changes = [
    { guid: guid(1), type: 'SYMBOL' },
    {
      guid: guid(2),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '!' },
      componentPropRefs: refs,
      symbolData: { symbolID: guid(3) }
    },
    { guid: guid(3), type: 'SYMBOL' },
    { guid: guid(4), type: 'SYMBOL' },
    {
      guid: guid(5),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(1),
        symbolOverrides: [{ guidPath: { guids: [guid(2)] }, overriddenSymbolID: guid(4) }]
      }
    }
  ] as NodeChange[]
  const child = interpretInstance(changes, '1:5').children[0]
  expect(child.mainComponentId).toBe('1:4')
  expect(child.properties.componentPropRefs).toEqual(refs)
  expect(child.properties.componentPropRefs).not.toBe(refs)
})

test('binding swaps retain source-root claims without mapping old children into the replacement', () => {
  const changes = [
    {
      guid: guid(1),
      type: 'SYMBOL',
      componentPropDefs: [
        { id: guid(80), initialValue: { guidValue: guid(3) }, type: 'INSTANCE_SWAP', name: 'Icon' }
      ]
    },
    {
      guid: guid(2),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '!' },
      componentPropRefs: [{ defID: guid(80), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }],
      symbolData: {
        symbolID: guid(3),
        symbolOverrides: [{ guidPath: { guids: [guid(90)] }, opacity: 0.4 }]
      }
    },
    { guid: guid(3), type: 'SYMBOL', overrideKey: guid(90) },
    { guid: guid(4), type: 'SYMBOL', overrideKey: guid(91) },
    {
      guid: guid(5),
      type: 'INSTANCE',
      symbolData: { symbolID: guid(1) },
      componentPropAssignments: [{ defID: guid(80), value: { guidValue: guid(4) } }]
    }
  ] as NodeChange[]
  const child = interpretInstance(changes, '1:5').children[0]
  expect(child.mainComponentId).toBe('1:4')
  expect(child.properties.opacity).toBe(0.4)
  expect(child.propertyClaims[0].path).toEqual([guid(90)])
})

test('component root-key assignments configure children before expansion', () => {
  const changes = [
    {
      guid: guid(1),
      overrideKey: guid(90),
      type: 'SYMBOL',
      componentPropDefs: [
        { id: guid(80), name: 'Label', type: 'TEXT', initialValue: { textValue: 'Default' } }
      ]
    },
    {
      guid: guid(3),
      type: 'TEXT',
      parentIndex: { guid: guid(1), position: '!' },
      componentPropRefs: [{ defID: guid(80), componentPropNodeField: 'TEXT_DATA' }]
    },
    {
      guid: guid(2),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(1),
        symbolOverrides: [
          {
            guidPath: { guids: [guid(90)] },
            componentPropAssignments: [{ defID: guid(80), value: { textValue: 'Assigned' } }]
          }
        ]
      }
    }
  ] as NodeChange[]
  expect(interpretInstance(changes, '1:2').children[0].properties.textData?.characters).toBe(
    'Assigned'
  )
})

test('a root-key swap replaces the component rather than resolving a child', () => {
  const changes = [
    { guid: guid(1), overrideKey: guid(90), type: 'SYMBOL' },
    { guid: guid(3), overrideKey: guid(91), type: 'SYMBOL', name: 'Replacement' },
    {
      guid: guid(4),
      type: 'TEXT',
      parentIndex: { guid: guid(3), position: '!' },
      textData: { characters: 'New' }
    },
    {
      guid: guid(2),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(1),
        symbolOverrides: [{ guidPath: { guids: [guid(90)] }, overriddenSymbolID: guid(3) }]
      }
    }
  ] as NodeChange[]
  const result = interpretInstance(changes, '1:2')
  expect(result.mainComponentId).toBe('1:3')
  expect(result.children[0].properties.textData?.characters).toBe('New')
})

test('component overrideKey addresses the root while placed instance size remains authoritative', () => {
  const changes = [
    { guid: guid(1), overrideKey: guid(90), type: 'SYMBOL', size: { x: 100, y: 40 } },
    {
      guid: guid(2),
      type: 'INSTANCE',
      size: { x: 50, y: 20 },
      symbolData: {
        symbolID: guid(1),
        uniformScaleFactor: 0.5,
        symbolOverrides: [
          { guidPath: { guids: [guid(90)] }, size: { x: 100, y: 40 }, opacity: 0.4 }
        ]
      }
    }
  ] as NodeChange[]
  const result = interpretInstance(changes, '1:2')
  expect(result.properties.opacity).toBe(0.4)
  expect(result.properties.size).toEqual({ x: 50, y: 20 })
})
