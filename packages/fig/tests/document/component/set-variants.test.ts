import { expect, test } from 'bun:test'

import {
  createSavedVariants,
  indexComponentSetVariants
} from '#fig/document/component/set-variants'
import { createSourceIndex } from '#fig/instance-overrides/source-index'
import { isComponentSetRecord } from '#fig/node-change/convert'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guid } from '@open-pencil/test-support/fig/guid'

/** Two sets saved as frames with a variant property, three variants each. */
function twoSets(): NodeChange[] {
  const setRecord = (id: number, propertyId: number): NodeChange =>
    ({
      guid: guid(id),
      type: 'FRAME',
      componentPropDefs: [{ id: guid(propertyId), type: 'VARIANT', name: 'State' }],
      parentIndex: { guid: guid(1), position: String(id) }
    }) as NodeChange
  const variantRecord = (id: number, setId: number, propertyId: number, value: string) =>
    ({
      guid: guid(id),
      type: 'SYMBOL',
      name: `State=Named ${value}`,
      variantPropSpecs: [{ propDefId: guid(propertyId), value }],
      parentIndex: { guid: guid(setId), position: String(id) }
    }) as NodeChange
  return [
    { guid: guid(1), type: 'CANVAS', internalOnly: true } as NodeChange,
    setRecord(10, 90),
    variantRecord(11, 10, 90, 'On'),
    variantRecord(12, 10, 90, 'Off'),
    variantRecord(13, 10, 90, 'Mixed'),
    setRecord(20, 91),
    variantRecord(21, 20, 91, 'On'),
    variantRecord(22, 20, 91, 'Off'),
    variantRecord(23, 20, 91, 'Mixed')
  ]
}

test('lists only the set asked for, from headers, with specs by property id', () => {
  const index = createSourceIndex(twoSets())
  const reads: string[] = []
  const saved = createSavedVariants({
    sets: () => indexComponentSetVariants(index, isComponentSetRecord),
    layerOf: () =>
      new Map([
        ['1:10', 'chip'],
        ['1:11', 'chip on'],
        ['1:20', 'toggle']
      ]),
    isBuilt: (id) => id === '1:11' || id.startsWith('1:2'),
    header: (id) => {
      reads.push(id)
      return index.sources.get(id)
    }
  })
  expect(saved.ofSetLayer('chip')).toEqual([
    {
      id: '1:11',
      name: 'State=Named On',
      specs: [{ propDefId: '1:90', value: 'On' }],
      layerId: 'chip on'
    },
    {
      id: '1:12',
      name: 'State=Named Off',
      specs: [{ propDefId: '1:90', value: 'Off' }],
      layerId: undefined
    },
    {
      id: '1:13',
      name: 'State=Named Mixed',
      specs: [{ propDefId: '1:90', value: 'Mixed' }],
      layerId: undefined
    }
  ])
  expect(saved.ofSetLayer('toggle')).toEqual([])
  expect(reads).toEqual(['1:11', '1:12', '1:13'])
})
