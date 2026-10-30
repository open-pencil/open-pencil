import { describe, expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { createDocumentReader } from '#fig/document/read'

import type { NodeChange, VariableConsumptionEntry } from '@open-pencil/kiwi/fig/codec'

const SHOW_ICON = guid(10)

function visibilityBinding(): VariableConsumptionEntry {
  return {
    variableField: 'VISIBLE',
    variableData: {
      value: { propRefValue: { defId: SHOW_ICON } },
      dataType: 'PROP_REF',
      resolvedDataType: 'BOOLEAN'
    }
  }
}

function iconShownWhenHidden(parameterEntries?: VariableConsumptionEntry[]): boolean | undefined {
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
      componentPropRefs: [{ defID: SHOW_ICON, componentPropNodeField: 'VISIBLE' }],
      ...(parameterEntries ? { parameterConsumptionMap: { entries: parameterEntries } } : {})
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

describe('component property references', () => {
  test('a property binding in the parameter map drives the layer', () => {
    expect(iconShownWhenHidden([visibilityBinding()])).toBe(false)
  })

  test('a reference the parameter map no longer carries is stale', () => {
    expect(iconShownWhenHidden([])).toBe(true)
  })

  test('a legacy reference drives the layer when the record has no parameter map', () => {
    expect(iconShownWhenHidden()).toBe(false)
  })
})
