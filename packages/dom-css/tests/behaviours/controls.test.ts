import { describe, expect, test } from 'bun:test'

import { behaviourControls, booleanOf } from '#dom-css/behaviours/controls'
import { controlRoles } from '#dom-css/behaviours/roles'

import { emptyBehaviour, SceneGraph, withBehaviour } from '@open-pencil/scene-graph'

/** A Switch set (State) and a card frame holding an On instance named Wifi. */
function switchCard() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name: 'Switch',
    componentPropertyDefinitions: [
      {
        id: 'state',
        name: 'State',
        type: 'VARIANT',
        defaultValue: 'Off',
        variantOptions: ['Off', 'On']
      }
    ]
  })
  graph.createNode('COMPONENT', set.id, {
    name: 'State=Off',
    componentPropertyValues: { State: 'Off' }
  })
  const on = graph.createNode('COMPONENT', set.id, {
    name: 'State=On',
    componentPropertyValues: { State: 'On' }
  })
  graph.updateNode(set.id, {
    pluginData: withBehaviour(set, {
      ...emptyBehaviour('switch'),
      booleans: { value: { propertyId: 'state', on: 'On', off: 'Off' } }
    })
  })
  const card = graph.createNode('FRAME', pageId, { name: 'Card' })
  const instance = graph.createInstance(on.id, card.id)
  if (!instance) throw new Error('No instance')
  graph.updateNode(instance.id, { name: 'Wifi' })
  return { graph, card }
}

describe('behaviour controls', () => {
  test('finds the controls below a root by layer path with the values their design shows', () => {
    const { graph, card } = switchCard()
    const controls = behaviourControls(graph, card.id)
    expect([...controls.keys()]).toEqual(['Wifi'])
    const control = controls.get('Wifi')
    expect(control?.kind).toBe('switch')
    expect(control && booleanOf(control, 'value')?.designed).toBe(true)
    expect(control && booleanOf(control, 'open')).toBeUndefined()
  })

  test('gives a control root its role by layer path', () => {
    const { graph, card } = switchCard()
    const roles = controlRoles(behaviourControls(graph, card.id))
    expect(roles.get('Wifi')?.type).toBe('root')
    expect(roles.size).toBe(1)
  })
})
