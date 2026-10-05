import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

/** `createInstance` returns null when the component cannot be placed; these fixtures require one. */
function placeInstance(graph: SceneGraph, componentId: string, parentId: string) {
  const instance = graph.createInstance(componentId, parentId)
  if (!instance) throw new Error(`Could not place an instance of ${componentId}`)
  return instance
}

/**
 * A component can gain a property-driven child after an instance of it exists. Cloning that
 * child into the instance must honour the assignment the instance already made, not the
 * component's default, which is what the instance would show everywhere else.
 */
function graphWithLateChild() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id, {
    name: 'NavItem',
    componentPropertyDefinitions: [
      { id: '207:1', name: 'Label', type: 'TEXT', defaultValue: 'Default' }
    ]
  })
  const instance = placeInstance(graph, component.id, page.id)
  graph.updateNode(instance.id, { componentPropertyAssignments: { '207:1': 'Assigned' } })
  return { graph, component, instance, page }
}

test('a child added after the instance takes the assigned text', () => {
  const { graph, component, instance } = graphWithLateChild()

  graph.createNode('TEXT', component.id, {
    name: 'Label',
    text: 'Default',
    componentPropertyReferences: [{ propertyId: '207:1', field: 'TEXT' }]
  })
  graph.syncInstances(component.id)

  const label = graph.getChildren(instance.id).find((child) => child.name === 'Label')
  expect(label?.text).toBe('Assigned')
})

test('an instance that assigns nothing still takes the component default', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id, {
    name: 'NavItem',
    componentPropertyDefinitions: [
      { id: '207:1', name: 'Label', type: 'TEXT', defaultValue: 'Default' }
    ]
  })
  const instance = placeInstance(graph, component.id, page.id)

  graph.createNode('TEXT', component.id, {
    name: 'Label',
    text: 'Default',
    componentPropertyReferences: [{ propertyId: '207:1', field: 'TEXT' }]
  })
  graph.syncInstances(component.id)

  const label = graph.getChildren(instance.id).find((child) => child.name === 'Label')
  expect(label?.text).toBe('Default')
})

test('a late visibility-driven child takes the assigned visibility', () => {
  const { graph, component, instance } = graphWithLateChild()
  graph.updateNode(component.id, {
    componentPropertyDefinitions: [
      { id: '207:1', name: 'Label', type: 'TEXT', defaultValue: 'Default' },
      { id: '207:2', name: 'Badge', type: 'BOOLEAN', defaultValue: 'true' }
    ]
  })
  graph.updateNode(instance.id, {
    componentPropertyAssignments: { '207:1': 'Assigned', '207:2': 'false' }
  })

  graph.createNode('RECTANGLE', component.id, {
    name: 'Badge',
    visible: true,
    componentPropertyReferences: [{ propertyId: '207:2', field: 'VISIBLE' }]
  })
  graph.syncInstances(component.id)

  const badge = graph.getChildren(instance.id).find((child) => child.name === 'Badge')
  expect(badge?.visible).toBe(false)
})

/**
 * A property id belongs to the component that defines it. A nested instance of a component that
 * defines the same id owns that reference, so an outer instance's unrelated property of the same
 * id must not reach it.
 */
test('a nested component that defines the id keeps an outer assignment out', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]

  const inner = graph.createNode('COMPONENT', page.id, {
    name: 'Inner',
    componentPropertyDefinitions: [
      { id: 'shared', name: 'Label', type: 'TEXT', defaultValue: 'Inner default' }
    ]
  })
  const outer = graph.createNode('COMPONENT', page.id, {
    name: 'Outer',
    componentPropertyDefinitions: [
      { id: 'shared', name: 'Caption', type: 'TEXT', defaultValue: 'Outer default' }
    ]
  })
  placeInstance(graph, inner.id, outer.id)

  const placed = placeInstance(graph, outer.id, page.id)
  graph.updateNode(placed.id, { componentPropertyAssignments: { shared: 'Outer assigned' } })

  // Inner gains a layer its own property drives, after everything above exists.
  graph.createNode('TEXT', inner.id, {
    name: 'Inner label',
    text: 'Inner default',
    componentPropertyReferences: [{ propertyId: 'shared', field: 'TEXT' }]
  })
  graph.syncInstances(inner.id)
  graph.syncInstances(outer.id)

  const innerInstance = graph
    .getChildren(placed.id)
    .find((child) => child.type === 'INSTANCE')
  const label = innerInstance
    ? graph.getChildren(innerInstance.id).find((child) => child.name === 'Inner label')
    : undefined

  expect(label?.text).toBe('Inner default')
})

/**
 * Only a component set's definitions reach its variants. A component nested inside an ordinary
 * component defines its own properties, so the outer component's must still reach through it.
 */
test('a component nested in a component does not own the outer property', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]

  const outer = graph.createNode('COMPONENT', page.id, {
    name: 'Outer',
    componentPropertyDefinitions: [
      { id: '207:1', name: 'Label', type: 'TEXT', defaultValue: 'Default' }
    ]
  })
  // A plain COMPONENT nested inside another COMPONENT, defining nothing of its own.
  const nested = graph.createNode('COMPONENT', outer.id, { name: 'Nested' })
  const nestedInstance = placeInstance(graph, nested.id, outer.id)

  const placed = placeInstance(graph, outer.id, page.id)
  graph.updateNode(placed.id, { componentPropertyAssignments: { '207:1': 'Assigned' } })

  graph.createNode('TEXT', nested.id, {
    name: 'Label',
    text: 'Default',
    componentPropertyReferences: [{ propertyId: '207:1', field: 'TEXT' }]
  })
  graph.syncInstances(nested.id)
  graph.syncInstances(outer.id)

  expect(nestedInstance).toBeDefined()
  const placedNested = graph.getChildren(placed.id).find((child) => child.type === 'INSTANCE')
  const label = placedNested
    ? graph.getChildren(placedNested.id).find((child) => child.name === 'Label')
    : undefined
  expect(label?.text).toBe('Assigned')
})
