import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { exposableInstances, exposedInstances } from '@open-pencil/scene-graph/components'

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
