import { expect, test } from 'bun:test'

import { expectPathError } from '#fig-tests/helpers/errors'
import { guid } from '#fig-tests/helpers/guid'
import { interpretInstance } from '#fig/instance-overrides/interpret'
import { symbolDataOf } from '#fig/instance-overrides/types'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

test('a root swap takes the replacement paint but keeps explicit root paint claims', () => {
  const paint = (r: number, g: number): NonNullable<NodeChange['fillPaints']> => [
    { type: 'SOLID', color: { r, g, b: 0, a: 1 }, visible: true, opacity: 1 }
  ]
  const red = paint(1, 0),
    green = paint(0, 1),
    yellow = paint(1, 1)
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'SYMBOL', fillPaints: red },
    { guid: guid(2), type: 'SYMBOL', fillPaints: green },
    {
      guid: guid(3),
      type: 'SYMBOL',
      componentPropDefs: [
        { id: guid(90), type: 'INSTANCE_SWAP', initialValue: { guidValue: guid(1) } }
      ]
    },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(3), position: '!' },
      fillPaints: red,
      symbolData: { symbolID: guid(1) },
      componentPropRefs: [{ defID: guid(90), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
    },
    {
      guid: guid(5),
      type: 'INSTANCE',
      symbolData: { symbolID: guid(3) },
      componentPropAssignments: [{ defID: guid(90), value: { guidValue: guid(2) } }]
    }
  ]
  const nested = () => interpretInstance(changes, '1:5').children[0]
  expect(nested().properties.fillPaints).toEqual(green)
  const source = changes[3],
    outer = changes[4]
  const sourceData = symbolDataOf(source),
    outerData = symbolDataOf(outer)
  if (!sourceData || !outerData) throw new Error('Missing paint owners')
  source.fillPaints = yellow
  expect(nested().properties.fillPaints).toEqual(green)
  source.fillPaints = []
  expect(nested().properties.fillPaints).toEqual(green)
  sourceData.symbolOverrides = [{ guidPath: { guids: [guid(1)] }, fillPaints: [] }]
  expect(nested().properties.fillPaints).toEqual([])
  sourceData.symbolOverrides = [{ guidPath: { guids: [guid(1)] }, fillPaints: yellow }]
  expect(nested().properties.fillPaints).toEqual(yellow)
  outerData.symbolOverrides = [{ guidPath: { guids: [guid(4)] }, fillPaints: [] }]
  expect(nested().properties.fillPaints).toEqual([])
  sourceData.symbolOverrides = []
  outerData.symbolOverrides = []
  source.fillPaints = yellow
  outer.componentPropAssignments = []
  expect(nested().properties.fillPaints).toEqual(yellow)
  changes.push(
    { guid: guid(6), type: 'SYMBOL', fillPaints: [] },
    {
      guid: guid(7),
      type: 'INSTANCE',
      symbolData: { symbolID: guid(3) },
      componentPropAssignments: [{ defID: guid(90), value: { guidValue: guid(2) } }]
    },
    {
      guid: guid(8),
      type: 'INSTANCE',
      symbolData: { symbolID: guid(7) },
      componentPropAssignments: [{ defID: guid(90), value: { guidValue: guid(6) } }]
    }
  )
  expect(interpretInstance(changes, '1:8').children[0].properties.fillPaints).toEqual([])
  changes[7].componentPropAssignments = [{ defID: guid(90), value: { guidValue: guid(1) } }]
  expect(interpretInstance(changes, '1:8').children[0].properties.fillPaints).toEqual(yellow)
  sourceData.symbolOverrides = [{ guidPath: { guids: [guid(1)] }, fillPaints: yellow }]
  expect(interpretInstance(changes, '1:8').children[0].properties.fillPaints).toEqual(yellow)
})

test('binding swap ignores known removed-child paint claims without discarding unswapped source claims', () => {
  const changes = [
    { guid: guid(1), type: 'SYMBOL' },
    {
      guid: guid(2),
      type: 'VECTOR',
      parentIndex: { guid: guid(1), position: '!' },
      fillPaints: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    },
    { guid: guid(3), type: 'SYMBOL' },
    {
      guid: guid(4),
      type: 'VECTOR',
      parentIndex: { guid: guid(3), position: '!' },
      fillPaints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    },
    {
      guid: guid(5),
      type: 'SYMBOL',
      componentPropDefs: [
        { id: guid(90), name: 'Icon', type: 'INSTANCE_SWAP', initialValue: { guidValue: guid(1) } }
      ]
    },
    {
      guid: guid(6),
      type: 'INSTANCE',
      parentIndex: { guid: guid(5), position: '!' },
      componentPropRefs: [{ defID: guid(90), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }],
      derivedSymbolData: [{ guidPath: { guids: [guid(2)] }, size: { x: 16, y: 16 } }],
      symbolData: {
        symbolID: guid(1),
        symbolOverrides: [{ guidPath: { guids: [guid(2)] }, fillPaints: [] }]
      }
    },
    { guid: guid(7), type: 'INSTANCE', symbolData: { symbolID: guid(5) } },
    {
      guid: guid(8),
      type: 'INSTANCE',
      derivedSymbolData: [{ guidPath: { guids: [guid(6), guid(2)] }, size: { x: 24, y: 24 } }],
      symbolData: { symbolID: guid(5) },
      componentPropAssignments: [{ defID: guid(90), value: { guidValue: guid(3) } }]
    }
  ] as NodeChange[]
  expect(interpretInstance(changes, '1:7').children[0].children[0].properties.fillPaints).toEqual(
    []
  )
  const original = changes.find((node) => node.guid?.localID === 6)
  if (!original?.symbolData) throw new Error('Missing source instance')
  const malformed = structuredClone(changes)
  const malformedSource = malformed.find((node) => node.guid?.localID === 6)
  if (!malformedSource?.symbolData) throw new Error('Missing malformed source')
  malformedSource.symbolData = {
    ...malformedSource.symbolData,
    symbolOverrides: [{ guidPath: { guids: [guid(999)] }, fillPaints: [] }]
  } as NodeChange['symbolData']
  expectPathError(() => interpretInstance(malformed, '1:8'), 'missing-target')
  const swapped = interpretInstance(changes, '1:8', { derivedBounds: true }).children[0]
  expect(swapped.children[0].derivedSize).toBeUndefined()
  expect(
    interpretInstance(changes, '1:7', { derivedBounds: true }).children[0].children[0].derivedSize
  ).toEqual({ x: 16, y: 16 })
  malformedSource.symbolData = structuredClone(original.symbolData)
  malformedSource.derivedSymbolData = [
    { guidPath: { guids: [guid(999)] }, size: { x: 16, y: 16 } }
  ] as NodeChange['derivedSymbolData']
  expectPathError(
    () => interpretInstance(malformed, '1:8', { derivedBounds: true }),
    'missing-target'
  )
  const ambiguousSource = structuredClone(changes)
  ambiguousSource.push({
    guid: guid(9),
    type: 'VECTOR',
    overrideKey: guid(2),
    parentIndex: { guid: guid(1), position: '"' }
  } as NodeChange)
  expect(() => interpretInstance(ambiguousSource, '1:8', { derivedBounds: true })).toThrow(
    'found 0'
  )
  expect(swapped.mainComponentId).toBe('1:3')
  const malformedOuter = structuredClone(changes)
  const outer = malformedOuter.find((node) => node.guid?.localID === 8)
  if (!outer) throw new Error('Missing outer instance')
  outer.derivedSymbolData = [
    { guidPath: { guids: [guid(6), guid(999)] }, size: { x: 24, y: 24 } }
  ] as NodeChange['derivedSymbolData']
  expectPathError(
    () => interpretInstance(malformedOuter, '1:8', { derivedBounds: true }),
    'missing-target'
  )
  expect(swapped.children[0].sourceId).toBe('1:4')
  expect(swapped.children[0].properties.fillPaints?.[0]?.color?.b).toBe(1)
  expect(interpretInstance(changes, '1:7').children[0].children[0].properties.fillPaints).toEqual(
    []
  )
})

test('a root swap drops the old fill style link along with the old paint', () => {
  const paint = (g: number): NonNullable<NodeChange['fillPaints']> => [
    { type: 'SOLID', color: { r: 1 - g, g, b: 0, a: 1 }, visible: true, opacity: 1 }
  ]
  const todoStyle = { guid: guid(80) },
    doneStyle = { guid: guid(81) }
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'SYMBOL', fillPaints: paint(0), styleIdForFill: todoStyle },
    { guid: guid(2), type: 'SYMBOL', fillPaints: paint(1), styleIdForFill: doneStyle },
    {
      guid: guid(3),
      type: 'SYMBOL',
      componentPropDefs: [
        { id: guid(90), type: 'INSTANCE_SWAP', initialValue: { guidValue: guid(1) } }
      ]
    },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(3), position: '!' },
      fillPaints: paint(0),
      styleIdForFill: todoStyle,
      symbolData: { symbolID: guid(1) },
      componentPropRefs: [{ defID: guid(90), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
    },
    {
      guid: guid(5),
      type: 'INSTANCE',
      symbolData: { symbolID: guid(3) },
      componentPropAssignments: [{ defID: guid(90), value: { guidValue: guid(2) } }]
    }
  ]
  const badge = interpretInstance(changes, '1:5').children[0].properties
  expect(badge.fillPaints).toEqual(paint(1))
  expect(badge.styleIdForFill).toEqual(doneStyle)
})
