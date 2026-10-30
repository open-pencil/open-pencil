import { describe, expect, test } from 'bun:test'

import { propertyBinding } from '#fig-tests/helpers/component-props'
import { guid } from '#fig-tests/helpers/guid'
import { createDocumentReader } from '#fig/document/read'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const SHOW_ICON = guid(10)

/** Whether the icon an instance hides through a boolean property still draws. */
function iconShownWhenHidden(binding: Partial<NodeChange>): boolean | undefined {
  const changes: NodeChange[] = [
    {
      guid: guid(1),
      type: 'SYMBOL',
      name: 'Card',
      componentPropDefs: [
        { id: SHOW_ICON, name: 'Show icon', type: 'BOOL', initialValue: { boolValue: true } }
      ]
    },
    {
      guid: guid(2),
      type: 'FRAME',
      name: 'Icon',
      parentIndex: { guid: guid(1), position: '!' },
      visible: true,
      ...binding
    },
    { guid: guid(3), type: 'CANVAS' },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(3), position: '!' },
      symbolData: { symbolID: guid(1) },
      componentPropAssignments: [{ defID: SHOW_ICON, value: { boolValue: false } }]
    }
  ]
  const card = createDocumentReader(changes).readPage('1:3').children[0]
  return card.children[0].properties.visible
}

const LEGACY_REF = { componentPropRefs: [{ defID: SHOW_ICON, componentPropNodeField: 'VISIBLE' }] }

// Figma reads a layer's property bindings from its parameter map only (live-verified).
describe('component property references', () => {
  test('a property binding in the parameter map drives the layer', () => {
    expect(iconShownWhenHidden({ ...LEGACY_REF, ...propertyBinding(SHOW_ICON, 'VISIBLE') })).toBe(
      false
    )
  })

  test('a legacy reference the parameter map no longer carries is stale', () => {
    expect(iconShownWhenHidden({ ...LEGACY_REF, parameterConsumptionMap: { entries: [] } })).toBe(
      true
    )
  })

  test('a legacy reference without a parameter map is stale too', () => {
    expect(iconShownWhenHidden(LEGACY_REF)).toBe(true)
  })
})
