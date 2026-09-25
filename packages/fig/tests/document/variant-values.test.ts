import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const guid = (localID: number) => ({ sessionID: 1, localID })

// A variant's specs name definitions owned by its component set; its own definitions do not
// include them, so the names can only resolve once the set exists in the graph.
test('variant property values resolve through the component set definitions', () => {
  const changes: NodeChange[] = [
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    {
      guid: guid(2),
      type: 'FRAME',
      isStateGroup: true,
      name: 'Button',
      parentIndex: { guid: guid(1), position: '!' },
      componentPropDefs: [
        { id: guid(10), name: 'State', type: 'VARIANT' },
        { id: guid(11), name: 'Label', type: 'TEXT', initialValue: { textValue: 'Button' } }
      ]
    },
    {
      guid: guid(3),
      type: 'SYMBOL',
      name: 'State=Disabled',
      parentIndex: { guid: guid(2), position: '!' },
      variantPropSpecs: [{ propDefId: guid(10), value: 'Disabled' }],
      componentPropDefs: [
        { id: guid(12), name: 'Icon', type: 'BOOL', initialValue: { boolValue: true } }
      ]
    } as NodeChange
  ]
  const { graph, sources } = materializeDocument(changes)
  const variant = graph.getNode(sources.get('1:3') ?? '')
  expect(variant?.componentPropertyValues).toEqual({ State: 'Disabled' })
  expect(variant?.variantPropSpecs).toEqual([{ propDefId: '1:10', value: 'Disabled' }])
})
