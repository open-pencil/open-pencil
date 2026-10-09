import { describe, expect, test } from 'bun:test'

import {
  canCreateInstance,
  exposableInstances,
  exposedInstances,
  SceneGraph
} from '@open-pencil/scene-graph'

function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const icon = graph.createNode('COMPONENT', page, { name: 'Icon' })
  const button = graph.createNode('COMPONENT', page, { name: 'Button' })
  const buttonIcon = graph.createInstance(icon.id, button.id, { name: 'Icon' })
  const card = graph.createNode('COMPONENT', page, { name: 'Card' })
  const footer = graph.createNode('FRAME', card.id, { name: 'Footer' })
  const action = graph.createInstance(button.id, footer.id, { name: 'Action' })
  const badge = graph.createInstance(icon.id, card.id, { name: 'Badge' })
  if (!buttonIcon || !action || !badge) throw new Error('instances were not created')
  return { graph, page, icon, button, card, action, badge }
}

describe('exposed nested instances', () => {
  test('a component can expose the instances in its own layers, not inside them', () => {
    const { graph, card, action, badge } = setup()
    expect(exposableInstances(graph, card.id).map((node) => node.id)).toEqual([action.id, badge.id])
  })

  test('an instance finds the layers its component exposes, wherever they are nested', () => {
    const { graph, page, card, action } = setup()
    graph.updateNode(action.id, { isExposedInstance: true })
    const instance = graph.createInstance(card.id, page)
    if (!instance) throw new Error('card instance was not created')

    const exposed = exposedInstances(graph, instance)
    expect(exposed.map((node) => node.name)).toEqual(['Action'])
    expect(exposed[0].id).not.toBe(action.id)
    expect(exposed[0].parentId).not.toBe(card.id)
  })

  test('exposure follows the component after the instance was created', () => {
    const { graph, page, card, action, badge } = setup()
    const instance = graph.createInstance(card.id, page)
    if (!instance) throw new Error('card instance was not created')
    expect(exposedInstances(graph, instance)).toEqual([])

    graph.updateNode(badge.id, { isExposedInstance: true })
    graph.updateNode(action.id, { isExposedInstance: true })
    expect(exposedInstances(graph, instance).map((node) => node.name)).toEqual(['Action', 'Badge'])
  })
})

describe('instance cycles', () => {
  test('refuses an instance that would contain its own component', () => {
    const { graph, icon, button, card } = setup()
    expect(canCreateInstance(graph, icon.id, card.id)).toBe(true)
    expect(canCreateInstance(graph, card.id, card.id)).toBe(false)
    // Button holds Icon, so Icon cannot hold Button, directly or through a nested layer.
    const frame = graph.createNode('FRAME', icon.id, { name: 'Holder' })
    expect(canCreateInstance(graph, button.id, frame.id)).toBe(false)
  })

  test('counts the component of an instance the new one would sit in', () => {
    const { graph, page, button, card } = setup()
    const outer = graph.createInstance(card.id, page)
    const action = outer && graph.getChildren(outer.id).find((node) => node.name === 'Footer')
    const copy = action && graph.getChildren(action.id).find((node) => node.name === 'Action')
    if (!copy) throw new Error('Expected the Action copy')
    // A layer inside a Button, wherever it is shown, cannot become another Button.
    expect(canCreateInstance(graph, button.id, copy.id)).toBe(false)
    expect(canCreateInstance(graph, card.id, copy.id)).toBe(false)
  })
})
