import { expect, test } from 'bun:test'

import { SceneGraph, findComponentPropertyTarget } from '@open-pencil/scene-graph'

test('component properties follow source identity when instance siblings are reordered', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id)
  const source = graph.createNode('RECTANGLE', component.id, {
    name: 'Target',
    componentPropertyReferences: [{ propertyId: 'show', field: 'VISIBLE' }]
  })
  graph.createNode('RECTANGLE', component.id, { name: 'Other' })
  const instance = graph.createInstance(component.id, page.id)
  if (!instance) throw new Error('Missing instance')
  const target = graph.getChildren(instance.id).find((node) => node.componentId === source.id)
  if (!target) throw new Error('Missing target')
  instance.childIds.reverse()
  expect(findComponentPropertyTarget(graph, instance, 'show')?.node.id).toBe(target.id)
})
