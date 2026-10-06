import { describe, expect, test } from 'bun:test'

import {
  behaviourFromSpec,
  behaviourToSpec,
  guessOnOff,
  SceneGraph
} from '@open-pencil/scene-graph'

/** A switch set with State and Interaction variant properties and a Thumb slot. */
function switchSet() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const set = graph.createNode('COMPONENT_SET', page.id, {
    name: 'Switch',
    componentPropertyDefinitions: [
      {
        id: 'p1',
        name: 'State',
        type: 'VARIANT',
        defaultValue: 'Off',
        variantOptions: ['Off', 'On']
      },
      {
        id: 'p2',
        name: 'Interaction',
        type: 'VARIANT',
        defaultValue: 'Default',
        variantOptions: ['Default', 'Hover']
      },
      { id: 'p3', name: 'Thumb', type: 'SLOT', defaultValue: '' }
    ]
  })
  return { graph, set }
}

describe('behaviour specs', () => {
  test('names resolve to the component’s property and slot ids, with on and off guessed', () => {
    const { graph, set } = switchSet()
    const behaviour = behaviourFromSpec(graph, set, {
      kind: 'switch',
      values: { value: 'State' },
      parts: { thumb: 'Thumb' },
      states: 'Interaction'
    })
    expect(behaviour.booleans.value).toEqual({ propertyId: 'p1', on: 'On', off: 'Off' })
    expect(behaviour.parts).toEqual({ thumb: 'p3' })
    expect(behaviour.states).toEqual({ propertyId: 'p2', rest: 'Default', hover: 'Hover' })

    expect(behaviourToSpec(graph, set, behaviour)).toEqual({
      kind: 'switch',
      values: { value: { property: 'State', on: 'On', off: 'Off' } },
      parts: { thumb: 'Thumb' },
      states: { property: 'Interaction', rest: 'Default', hover: 'Hover' }
    })
  })

  test('on and off are guessed by name before order', () => {
    expect(guessOnOff(['Off', 'On'])).toEqual({ on: 'On', off: 'Off' })
    expect(guessOnOff(['False', 'True'])).toEqual({ on: 'True', off: 'False' })
    expect(guessOnOff(['Small', 'Large'])).toEqual({ on: 'Small', off: 'Large' })
  })

  test('a name or value the component lacks fails with what it has', () => {
    const { graph, set } = switchSet()
    expect(() =>
      behaviourFromSpec(graph, set, { kind: 'switch', values: { value: 'Checked' } })
    ).toThrow(
      'needs a VARIANT or BOOLEAN property named "Checked"; the component has "State", "Interaction"'
    )
    expect(() =>
      behaviourFromSpec(graph, set, { kind: 'switch', parts: { knob: 'Thumb' } })
    ).toThrow('A switch has no part "knob"; it has "thumb"')
    expect(() =>
      behaviourFromSpec(graph, set, {
        kind: 'switch',
        values: { value: { property: 'State', on: 'Enabled' } }
      })
    ).toThrow('"State" has no value "Enabled"; it has Off, On')
    expect(() =>
      behaviourFromSpec(graph, set, { kind: 'slider', numbers: { value: { min: 10, max: 5 } } })
    ).toThrow('"value" needs max above min and a positive step')
    expect(() =>
      behaviourFromSpec(graph, set, { kind: 'slider', parts: { track: 'Thumb', thumb: 'Thumb' } })
    ).toThrow('"Thumb" is already the track; a slot draws one part')
  })
})
