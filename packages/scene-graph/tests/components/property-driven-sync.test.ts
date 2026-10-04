import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

function graphWithAssignedLabel() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id, {
    name: 'NavItem',
    componentPropertyDefinitions: [
      { id: '207:1', name: 'Label', type: 'TEXT', defaultValue: 'Default' }
    ]
  })
  const label = graph.createNode('TEXT', component.id, {
    name: 'Label',
    text: 'Default',
    componentPropertyReferences: [{ propertyId: '207:1', field: 'TEXT' }]
  })
  const instance = graph.createInstance(component.id, page.id)
  return { graph, component, label, instance }
}

/**
 * A component states the default for a field a property drives; the enclosing instance's
 * assignment decides the value. Synchronising must not copy the default over it.
 */
test('synchronizing leaves a field the enclosing instance assigns alone', () => {
  const { graph, component, instance } = graphWithAssignedLabel()
  const clone = graph.getChildren(instance.id)[0]
  graph.updateNode(instance.id, { componentPropertyAssignments: { '207:1': 'Assigned' } })
  graph.updateNode(clone.id, { text: 'Assigned' })

  graph.syncInstances(component.id)

  expect(graph.getNode(clone.id)?.text).toBe('Assigned')
})

test('synchronizing still carries the default to an instance that assigns nothing', () => {
  const { graph, component, label, instance } = graphWithAssignedLabel()
  const clone = graph.getChildren(instance.id)[0]

  graph.updateNode(label.id, { text: 'Edited default' })
  graph.syncInstances(component.id)

  expect(graph.getNode(clone.id)?.text).toBe('Edited default')
})

/** Only the referenced field is left alone; the rest of the component edit still lands. */
test('synchronizing carries other fields of a property-driven layer', () => {
  const { graph, component, label, instance } = graphWithAssignedLabel()
  const clone = graph.getChildren(instance.id)[0]
  graph.updateNode(instance.id, { componentPropertyAssignments: { '207:1': 'Assigned' } })
  graph.updateNode(clone.id, { text: 'Assigned' })

  graph.updateNode(label.id, { opacity: 0.5 })
  graph.syncInstances(component.id)

  expect(graph.getNode(clone.id)?.text).toBe('Assigned')
  expect(graph.getNode(clone.id)?.opacity).toBe(0.5)
})

/** Property IDs are document-authored strings, so one may collide with an Object prototype key. */
test('a property id shared with an Object prototype key is not read as an assignment', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id, {
    name: 'NavItem',
    componentPropertyDefinitions: [
      { id: 'toString', name: 'Label', type: 'TEXT', defaultValue: 'Default' }
    ]
  })
  const label = graph.createNode('TEXT', component.id, {
    name: 'Label',
    text: 'Default',
    componentPropertyReferences: [{ propertyId: 'toString', field: 'TEXT' }]
  })
  const instance = graph.createInstance(component.id, page.id)
  const clone = graph.getChildren(instance.id)[0]

  graph.updateNode(label.id, { text: 'Edited default' })
  graph.syncInstances(component.id)

  expect(graph.getNode(clone.id)?.text).toBe('Edited default')
})
