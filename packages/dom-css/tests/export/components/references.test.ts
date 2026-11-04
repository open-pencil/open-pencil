import { describe, expect, test } from 'bun:test'

import { componentSet, COLORS } from '#dom-css-tests/behaviours/fixtures'
import { componentModel } from '#dom-css/export/components/model'
import { referenceValues } from '#dom-css/export/components/references'

import { emptyBehaviour } from '@open-pencil/scene-graph/behaviours'

/** A checkbox that draws invalid twice: as its own Invalid property and as a State value. */
function doublyInvalidCheckbox() {
  return componentSet(
    'Checkbox',
    { Checked: ['Off', 'On'], Invalid: ['No', 'Yes'], State: ['Default', 'Invalid'] },
    {
      ...emptyBehaviour('checkbox'),
      booleans: {
        value: { propertyId: 'checked', on: 'On', off: 'Off' },
        invalid: { propertyId: 'invalid', on: 'Yes', off: 'No' }
      },
      states: { propertyId: 'state', rest: 'Default', invalid: 'Invalid' }
    },
    (graph, variant) => graph.updateNode(variant, { fills: COLORS.white })
  )
}

describe('component references', () => {
  test('an instance drawn invalid both ways sets invalid once', () => {
    const { graph, set } = doublyInvalidCheckbox()
    const model = componentModel(graph, set)
    if (!model) throw new Error('No component model')
    const variant = graph
      .getChildren(set.id)
      .find((child) => child.name === 'Checked=Off, Invalid=Yes, State=Invalid')
    if (!variant) throw new Error('No invalid variant')
    const instance = graph.createInstance(variant.id, graph.getPages()[0].id)
    if (!instance) throw new Error('No instance')
    const { props } = referenceValues(graph, instance, model)
    expect(props.filter((prop) => prop.name === 'invalid')).toEqual([
      { name: 'invalid', value: true }
    ])
  })
})
