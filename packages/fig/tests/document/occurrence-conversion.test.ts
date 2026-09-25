import { expect, test } from 'bun:test'

import { nodeChangeToProps } from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { guid } from '../helpers/guid'

test('instances do not duplicate component-owned property definitions', () => {
  const source = {
    type: 'INSTANCE',
    componentPropDefs: [
      { id: guid(90), name: 'Label', type: 'TEXT', initialValue: { textValue: 'Default' } }
    ],
    componentPropAssignments: [{ defID: guid(90), value: { textValue: 'Assigned' } }]
  } as NodeChange
  const props = nodeChangeToProps(source, [], 'occurrence')
  expect(props.componentPropertyDefinitions).toEqual([])
  expect(props.componentPropertyAssignments).toEqual({ '1:90': 'Assigned' })
  expect(
    nodeChangeToProps({ ...source, type: 'SYMBOL' }, []).componentPropertyDefinitions
  ).toHaveLength(1)
})

test('occurrence conversion preserves editable properties without constructing discarded raw metadata', () => {
  const source: NodeChange = {
    guid: guid(1),
    type: 'FRAME',
    name: 'Content',
    size: { x: 120, y: 40 },
    stackMode: 'HORIZONTAL',
    stackCounterSizing: 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE',
    fillPaints: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
  }
  const full = nodeChangeToProps(source, [])
  const occurrence = nodeChangeToProps(source, [], 'occurrence')
  const { source: fullMetadata, ...fullProps } = full
  const { source: occurrenceMetadata, ...occurrenceProps } = occurrence
  expect(occurrenceProps).toEqual(fullProps)
  expect(occurrenceMetadata?.fig.layout).toEqual(fullMetadata?.fig.layout)
  expect(occurrenceMetadata?.id).toBeNull()
  expect(occurrenceMetadata?.fig.rawNodeFields).toEqual({})
  if (!occurrence.fills?.[0]?.color) throw new Error('Missing fill')
  occurrence.fills[0].color.r = 0
  expect(full.fills?.[0]?.color?.r).toBe(1)
  expect(source.fillPaints?.[0]?.color?.r).toBe(1)
})
