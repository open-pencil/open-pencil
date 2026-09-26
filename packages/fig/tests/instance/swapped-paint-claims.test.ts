import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

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
  expect(() => interpretInstance(malformed, '1:8')).toThrow('found 0')
  const swapped = interpretInstance(changes, '1:8', { derivedBounds: true }).children[0]
  expect(swapped.children[0].derivedSize).toBeUndefined()
  expect(
    interpretInstance(changes, '1:7', { derivedBounds: true }).children[0].children[0].derivedSize
  ).toEqual({ x: 16, y: 16 })
  malformedSource.symbolData = structuredClone(original.symbolData)
  malformedSource.derivedSymbolData = [
    { guidPath: { guids: [guid(999)] }, size: { x: 16, y: 16 } }
  ] as NodeChange['derivedSymbolData']
  expect(() => interpretInstance(malformed, '1:8', { derivedBounds: true })).toThrow('found 0')
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
  expect(() => interpretInstance(malformedOuter, '1:8', { derivedBounds: true })).toThrow('found 0')
  expect(swapped.children[0].sourceId).toBe('1:4')
  expect(swapped.children[0].properties.fillPaints?.[0]?.color?.b).toBe(1)
  expect(interpretInstance(changes, '1:7').children[0].children[0].properties.fillPaints).toEqual(
    []
  )
})
