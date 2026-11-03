import { describe, expect, test } from 'bun:test'

import { behaviourControls } from '@open-pencil/dom-css/export'
import { SceneGraph } from '@open-pencil/scene-graph'
import { emptyBehaviour, withBehaviour } from '@open-pencil/scene-graph/behaviours'

import { createIslandState, instanceStates } from '#vue/canvas/islands/state'

const STATES = ['Default', 'Focus', 'Disabled', 'Invalid']

/** A checkbox as the shadcn/ui kit draws one, and a form holding one drawn `shown`. */
function form(shown: string) {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name: 'Checkbox',
    componentPropertyDefinitions: [
      { id: 'state', name: 'State', type: 'VARIANT', defaultValue: 'Default', variantOptions: STATES }
    ]
  })
  const variants = STATES.map((state) =>
    graph.createNode('COMPONENT', set.id, {
      name: `State=${state}`,
      componentPropertyValues: { State: state }
    })
  )
  graph.updateNode(set.id, {
    pluginData: withBehaviour(set, {
      ...emptyBehaviour('checkbox'),
      states: {
        propertyId: 'state',
        rest: 'Default',
        focus: 'Focus',
        disabled: 'Disabled',
        invalid: 'Invalid'
      }
    })
  })
  const card = graph.createNode('FRAME', pageId, { name: 'Form' })
  const variant = variants[STATES.indexOf(shown)]
  if (!variant) throw new Error(`No ${shown} variant`)
  graph.createInstance(variant.id, card.id)
  const controls = behaviourControls(graph, card.id)
  const state = createIslandState(controls)
  const [control] = controls.values()
  if (!control) throw new Error('No control')
  const { path } = control
  const current = state.get(path)
  if (!current) throw new Error('No state')
  const shows = () => instanceStates(controls, state).get(path)?.prefer?.State
  return { current, shows }
}

describe('preview island states', () => {
  test('a control drawn invalid stays invalid in focus, and shows disabled over it', () => {
    const { current, shows } = form('Invalid')
    expect(shows()).toBe('Invalid')
    current.focused = true
    expect(shows()).toBe('Invalid')
    current.booleans.disabled = true
    expect(shows()).toBe('Disabled')
  })

  test('a valid control still shows focus', () => {
    const { current, shows } = form('Default')
    current.focused = true
    expect(shows()).toBe('Focus')
  })
})
