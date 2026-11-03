import { describe, expect, test } from 'bun:test'

import { progressComponent, sliderComponent } from '#dom-css-tests/behaviours/fixtures'
import { behaviourControls, booleanOf } from '#dom-css/behaviours/controls'
import { controlRoles } from '#dom-css/behaviours/roles'

import { SceneGraph } from '@open-pencil/scene-graph'
import { emptyBehaviour, withBehaviour } from '@open-pencil/scene-graph/behaviours'

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

  // Figma (desktop 126) keeps a slot inside another slot of a component; in an instance the inner
  // one is part of the outer one's content. Preview runs the instance, so it must still find it.
  test('finds the parts an instance holds inside another part', () => {
    for (const [build, parts] of [
      [sliderComponent, ['range', 'thumb', 'track']],
      [progressComponent, ['indicator', 'track']]
    ] as const) {
      const { graph, set } = build()
      const card = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Card' })
      const instance = graph.createInstance(set.id, card.id)
      if (!instance) throw new Error('No instance')
      const control = behaviourControls(graph, card.id).get(instance.name)
      expect(Object.keys(control?.parts ?? {}).sort()).toEqual([...parts])
    }
  })

  test('gives a control root its role by layer path', () => {
    const { graph, card } = switchCard()
    const roles = controlRoles(behaviourControls(graph, card.id))
    expect(roles.get('Wifi')?.type).toBe('root')
    expect(roles.size).toBe(1)
  })
})
