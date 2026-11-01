import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { applyComponentPropertyValue } from '@open-pencil/scene-graph/components'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'

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
  if (!instance) throw new Error('Missing instance')
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

test('synchronizing preserves a direct text override over a property assignment', () => {
  const { graph, component, label, instance } = graphWithAssignedLabel()
  const clone = graph.getChildren(instance.id)[0]
  graph.updateNode(instance.id, { componentPropertyAssignments: { '207:1': 'Assigned' } })
  graph.updateNode(clone.id, { text: 'Local override' })
  recordInstanceOverride(graph, clone.id, ['text'])
  graph.updateNode(label.id, { opacity: 0.5 })

  graph.syncInstances(component.id)

  expect(clone.text).toBe('Local override')
  expect(clone.opacity).toBe(0.5)
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

test('a nested instance takes its visibility from its parent, not its own child assignment', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const definitions = [
    { id: '207:2', name: 'Visible', type: 'BOOLEAN' as const, defaultValue: 'false' }
  ]
  const inner = graph.createNode('COMPONENT', page.id, {
    componentPropertyDefinitions: definitions
  })
  graph.createNode('RECTANGLE', inner.id, {
    visible: false,
    componentPropertyReferences: [{ propertyId: '207:2', field: 'VISIBLE' }]
  })
  const outer = graph.createNode('COMPONENT', page.id, {
    componentPropertyDefinitions: definitions
  })
  const nested = graph.createInstance(inner.id, outer.id, {
    visible: false,
    componentPropertyReferences: [{ propertyId: '207:2', field: 'VISIBLE' }],
    componentPropertyAssignments: { '207:2': 'false' }
  })
  const instance = graph.createInstance(outer.id, page.id, {
    componentPropertyAssignments: { '207:2': 'true' }
  })
  if (!nested || !instance) throw new Error('Missing nested instance')
  const clone = graph.getChildren(instance.id)[0]
  graph.updateNode(clone.id, { visible: true })
  graph.updateNode(nested.id, { opacity: 0.5 })
  for (const visible of [true, false, true]) {
    applyComponentPropertyValue(graph, instance.id, definitions[0], String(visible))
    graph.syncInstances(outer.id)
    expect(graph.getNode(clone.id)?.visible).toBe(visible)
    expect(graph.getNode(clone.id)?.opacity).toBe(0.5)
    expect(graph.getChildren(clone.id)[0].visible).toBe(false)
  }
  applyComponentPropertyValue(graph, clone.id, definitions[0], 'true')
  graph.syncInstances(inner.id)
  expect(graph.getNode(clone.id)?.visible).toBe(true)
  expect(graph.getChildren(clone.id)[0].visible).toBe(true)
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
  if (!instance) throw new Error('Missing instance')
  const clone = graph.getChildren(instance.id)[0]

  graph.updateNode(label.id, { text: 'Edited default' })
  graph.syncInstances(component.id)

  expect(graph.getNode(clone.id)?.text).toBe('Edited default')
})
