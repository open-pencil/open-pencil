import { expect, test } from 'bun:test'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { interpretInstance } from '../src/instance-overrides/interpret'
import type { SymbolOverride } from '../src/instance-overrides/types'

const guid = (localID: number) => ({ sessionID: 1, localID })

function withRootOverrides(
  changes: NodeChange[],
  localID: number,
  overrides: SymbolOverride[]
): void {
  const node = changes.find((source) => source.guid?.localID === localID)
  if (!node?.symbolData) throw new Error('Missing instance')
  node.symbolData = { ...node.symbolData, symbolOverrides: overrides } as NodeChange['symbolData']
}

test('outer bindings control nested instance roots without entering their component scope', () => {
  const changes = fixture()
  const icon = changes.find((node) => node.guid?.localID === 4)
  const inner = changes.find((node) => node.guid?.localID === 10)
  const innerLeaf = changes.find((node) => node.guid?.localID === 11)
  if (!icon || !inner || !innerLeaf) throw new Error('Missing fixture nodes')
  icon.componentPropRefs = [{ defID: guid(90), componentPropNodeField: 'VISIBLE' }]
  inner.componentPropDefs = [
    { id: guid(90), name: 'Inner shown', type: 'BOOL', initialValue: { boolValue: false } }
  ]
  innerLeaf.componentPropRefs = [{ defID: guid(90), componentPropNodeField: 'VISIBLE' }]
  withRootOverrides(changes, 30, [{ guidPath: { guids: [guid(22), guid(4)] }, visible: false }])
  changes.push(
    { guid: guid(50), type: 'SYMBOL' },
    {
      guid: guid(51),
      type: 'INSTANCE',
      parentIndex: { guid: guid(50), position: '!' },
      symbolData: { symbolID: guid(30) }
    },
    { guid: guid(52), type: 'INSTANCE', symbolData: { symbolID: guid(50) } }
  )
  withRootOverrides(changes, 52, [
    {
      guidPath: { guids: [guid(51), guid(22)] },
      componentPropAssignments: [{ defID: guid(90), value: { boolValue: true } }]
    }
  ])
  const target = interpretInstance(changes, '1:52').children[0].children[1].children[0].children[1]
  expect(target.properties.visible).toBe(true)
  expect(target.children[0].properties.visible).toBe(false)
})

test('a newer binding wins over an intermediate patch to the same text field', () => {
  const changes = fixture()
  withRootOverrides(changes, 30, [
    {
      guidPath: { guids: [guid(22), guid(3)] },
      textData: { characters: 'Intermediate edit' },
      opacity: 0.4
    }
  ])
  changes.push(
    { guid: guid(50), type: 'SYMBOL' },
    {
      guid: guid(51),
      type: 'INSTANCE',
      parentIndex: { guid: guid(50), position: '!' },
      symbolData: { symbolID: guid(30) }
    },
    { guid: guid(52), type: 'INSTANCE', symbolData: { symbolID: guid(50) } }
  )
  withRootOverrides(changes, 52, [
    {
      guidPath: { guids: [guid(51), guid(22)] },
      componentPropAssignments: [{ defID: guid(91), value: { textValue: 'Outer assignment' } }]
    }
  ])
  const label = interpretInstance(changes, '1:52').children[0].children[1].children[0].children[0]
  expect(label.properties.textData?.characters).toBe('Outer assignment')
  expect(label.properties.opacity).toBe(0.4)
})

test('retains an intermediate explicit descendant override when an outer binding changes', () => {
  const changes = fixture()
  withRootOverrides(changes, 30, [
    {
      guidPath: { guids: [guid(22), guid(3)] },
      opacity: 0.4
    }
  ])
  changes.push(
    { guid: guid(50), type: 'SYMBOL' },
    {
      guid: guid(51),
      type: 'INSTANCE',
      parentIndex: { guid: guid(50), position: '!' },
      symbolData: { symbolID: guid(30) }
    },
    { guid: guid(52), type: 'INSTANCE', symbolData: { symbolID: guid(50) } }
  )
  withRootOverrides(changes, 52, [
    {
      guidPath: { guids: [guid(51), guid(22)] },
      componentPropAssignments: [{ defID: guid(91), value: { textValue: 'Outer text' } }]
    }
  ])
  const result = interpretInstance(changes, '1:52')
  const label = result.children[0].children[1].children[0].children[0]
  expect(label.properties.textData?.characters).toBe('Outer text')
  expect(label.properties.opacity).toBe(0.4)

  withRootOverrides(changes, 52, [
    {
      guidPath: { guids: [guid(51), guid(22)] },
      componentPropAssignments: [{ defID: guid(91), value: { textValue: 'Outer text' } }]
    },
    { guidPath: { guids: [guid(51), guid(22), guid(3)] }, opacity: 0.8 }
  ])
  const overridden = interpretInstance(changes, '1:52').children[0].children[1].children[0]
    .children[0]
  expect(overridden.properties.opacity).toBe(0.8)
})

test('retains intermediate-owner assignments when an outer owner configures another property', () => {
  const changes = fixture()
  withRootOverrides(changes, 30, [
    {
      guidPath: { guids: [guid(22)] },
      componentPropAssignments: [{ defID: guid(90), value: { boolValue: true } }]
    }
  ])
  changes.push(
    { guid: guid(50), type: 'SYMBOL' },
    {
      guid: guid(51),
      type: 'INSTANCE',
      parentIndex: { guid: guid(50), position: '!' },
      symbolData: { symbolID: guid(30) }
    },
    { guid: guid(52), type: 'INSTANCE', symbolData: { symbolID: guid(50) } }
  )
  withRootOverrides(changes, 52, [
    {
      guidPath: { guids: [guid(51), guid(22)] },
      componentPropAssignments: [{ defID: guid(91), value: { textValue: 'Outer text' } }]
    }
  ])
  const result = interpretInstance(changes, '1:52')
  const label = result.children[0].children[1].children[0].children[0]
  expect(label.properties.visible).toBe(true)
  expect(label.properties.textData?.characters).toBe('Outer text')
})

test('combines repeated assignment entries by property, with later values winning', () => {
  const changes = fixture()
  withRootOverrides(changes, 30, [
    {
      guidPath: { guids: [guid(22)] },
      componentPropAssignments: [
        { defID: guid(90), value: { boolValue: true } },
        { defID: guid(91), value: { textValue: 'Earlier' } }
      ]
    },
    {
      guidPath: { guids: [guid(22)] },
      componentPropAssignments: [{ defID: guid(91), value: { textValue: 'Later' } }]
    }
  ])
  const second = interpretInstance(changes, '1:30').children[1].children[0].children
  expect(second[0].properties.visible).toBe(true)
  expect(second[0].properties.textData?.characters).toBe('Later')
  expect(second[1].mainComponentId).toBe('1:12')
})

test('applies root-targeted assignments without re-entering the same instance', () => {
  const changes = fixture()
  withRootOverrides(changes, 22, [
    {
      guidPath: { guids: [guid(1)] },
      componentPropAssignments: [{ defID: guid(91), value: { textValue: 'Root assignment' } }]
    }
  ])
  const second = interpretInstance(changes, '1:30').children[1].children[0].children
  expect(second[0].properties.textData?.characters).toBe('Root assignment')
  expect(second[0].properties.visible).toBe(false)
})

test('applies assignments to the replacement component before descendant overrides', () => {
  const changes = fixture()
  changes.push(
    {
      guid: guid(40),
      type: 'SYMBOL',
      componentPropDefs: [
        {
          id: guid(93),
          name: 'Replacement text',
          type: 'TEXT',
          initialValue: { textValue: 'Replacement default' }
        }
      ]
    },
    {
      guid: guid(41),
      type: 'TEXT',
      parentIndex: { guid: guid(40), position: '!' },
      componentPropRefs: [{ defID: guid(93), componentPropNodeField: 'TEXT_DATA' }]
    }
  )
  withRootOverrides(changes, 30, [
    { guidPath: { guids: [guid(22), guid(41)] }, fontSize: 24 },
    { guidPath: { guids: [guid(22)] }, overriddenSymbolID: guid(40) },
    {
      guidPath: { guids: [guid(22)] },
      componentPropAssignments: [{ defID: guid(93), value: { textValue: 'Assigned replacement' } }]
    }
  ])
  const result = interpretInstance(changes, '1:30')
  expect(result.children[1].mainComponentId).toBe('1:40')
  expect(result.children[1].children[0].properties.textData?.characters).toBe(
    'Assigned replacement'
  )
  expect(result.children[1].children[0].properties.fontSize).toBe(24)
  expect(result.children[0].children[0].children[0].properties.textData?.characters).toBe('Default')
})

function fixture(): NodeChange[] {
  return [
    {
      guid: guid(1),
      type: 'SYMBOL',
      componentPropDefs: [
        { id: guid(90), name: 'Shown', type: 'BOOL', initialValue: { boolValue: true } },
        { id: guid(91), name: 'Text', type: 'TEXT', initialValue: { textValue: 'Default' } },
        { id: guid(92), name: 'Icon', type: 'INSTANCE_SWAP', initialValue: { guidValue: guid(10) } }
      ]
    },
    { guid: guid(2), type: 'FRAME', parentIndex: { guid: guid(1), position: '!' } },
    {
      guid: guid(3),
      type: 'TEXT',
      parentIndex: { guid: guid(2), position: '!' },
      componentPropRefs: [
        { defID: guid(90), componentPropNodeField: 'VISIBLE' },
        { defID: guid(91), componentPropNodeField: 'TEXT_DATA' }
      ]
    },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(2), position: '"' },
      symbolData: { symbolID: guid(10) },
      componentPropRefs: [{ defID: guid(92), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
    },
    { guid: guid(10), type: 'SYMBOL' },
    { guid: guid(11), type: 'RECTANGLE', parentIndex: { guid: guid(10), position: '!' } },
    { guid: guid(12), type: 'SYMBOL' },
    { guid: guid(13), type: 'ELLIPSE', parentIndex: { guid: guid(12), position: '!' } },
    { guid: guid(20), type: 'SYMBOL' },
    {
      guid: guid(21),
      type: 'INSTANCE',
      parentIndex: { guid: guid(20), position: '!' },
      symbolData: { symbolID: guid(1) }
    },
    {
      guid: guid(22),
      type: 'INSTANCE',
      parentIndex: { guid: guid(20), position: '"' },
      symbolData: { symbolID: guid(1) },
      componentPropAssignments: [
        { defID: guid(90), value: { boolValue: false } },
        { defID: guid(91), value: { textValue: 'Second' } },
        { defID: guid(92), value: { guidValue: guid(12) } }
      ]
    },
    { guid: guid(30), type: 'INSTANCE', symbolData: { symbolID: guid(20) } }
  ] as NodeChange[]
}

test('isolates Boolean, text and swap bindings in repeated wrapper instances', () => {
  const changes = fixture()
  const before = structuredClone(changes)
  const result = interpretInstance(changes, '1:30')
  const [first, second] = result.children.map((node) => node.children[0].children)
  expect(first[0].properties.visible).toBe(true)
  expect(first[0].properties.textData?.characters).toBe('Default')
  expect(first[1].mainComponentId).toBe('1:10')
  expect(second[0].properties.visible).toBe(false)
  expect(second[0].properties.textData?.characters).toBe('Second')
  expect(second[1].mainComponentId).toBe('1:12')
  expect(second[1].children[0].properties.type).toBe('ELLIPSE')
  expect(changes).toEqual(before)
})

test('outer nested assignments override inherited values without leaking to siblings', () => {
  const changes = fixture()
  const root = changes.find((node) => node.guid?.localID === 30)
  if (!root) throw new Error('Missing root')
  root.symbolData = {
    symbolID: guid(20),
    symbolOverrides: [
      {
        guidPath: { guids: [guid(22)] },
        componentPropAssignments: [
          { defID: guid(90), value: { boolValue: true } },
          { defID: guid(91), value: { textValue: 'Outer assignment' } },
          { defID: guid(92), value: { guidValue: guid(10) } }
        ]
      }
    ]
  } as NodeChange['symbolData']
  const result = interpretInstance(changes, '1:30')
  const [first, second] = result.children.map((node) => node.children[0].children)
  expect(first[0].properties.textData?.characters).toBe('Default')
  expect(second[0].properties.textData?.characters).toBe('Outer assignment')
  expect(second[0].properties.visible).toBe(true)
  expect(second[1].mainComponentId).toBe('1:10')
})
