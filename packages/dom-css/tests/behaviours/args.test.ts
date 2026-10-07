import { describe, expect, test } from 'bun:test'

import { behaviourArgs } from '#dom-css/behaviours/args'

import { emptyBehaviour, SceneGraph, withBehaviour } from '@open-pencil/scene-graph'

function toggleSet(options: string[]) {
  const graph = new SceneGraph()
  const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, {
    name: 'Toggle',
    componentPropertyDefinitions: [
      {
        id: 'pressed',
        name: 'Pressed',
        type: 'VARIANT',
        defaultValue: 'No',
        variantOptions: options
      }
    ]
  })
  graph.updateNode(set.id, {
    pluginData: withBehaviour(set, {
      ...emptyBehaviour('toggle'),
      booleans: { value: { propertyId: 'pressed', on: 'Yes', off: 'No' } }
    })
  })
  return { graph, set }
}

describe('behaviour args', () => {
  test('a boolean value drawn by an on/off variant property is a prop named as Reka names it', () => {
    const { graph, set } = toggleSet(['No', 'Yes'])
    expect([...(behaviourArgs(graph, set)?.booleans ?? [])]).toEqual([
      ['Pressed', { name: 'pressed', on: 'Yes', off: 'No' }]
    ])
  })

  test('a property with values beyond on and off stays a variant', () => {
    const { graph, set } = toggleSet(['No', 'Yes', 'Mixed'])
    expect(behaviourArgs(graph, set)?.booleans.size).toBe(0)
  })

  test('a component without a behaviour has no behaviour props', () => {
    const graph = new SceneGraph()
    const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, { name: 'Card' })
    expect(behaviourArgs(graph, set)).toBeNull()
  })
})
