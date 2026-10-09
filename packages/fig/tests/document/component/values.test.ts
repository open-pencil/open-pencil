import { expect, test } from 'bun:test'

import { linkComponentPropertyValues } from '#fig/document/component/values'

import { SceneGraph } from '@open-pencil/scene-graph'

// Layers inside instances hold their component layers' own objects, so linking replaces a
// layer's definitions and assignments instead of writing into objects other layers hold.
test('linking component property values leaves objects other layers hold untouched', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const definitions = [
    { id: 'swap', name: 'Icon', type: 'INSTANCE_SWAP' as const, defaultValue: '1:2' }
  ]
  const assignments = { swap: '1:2' }
  const component = graph.createNode('COMPONENT', page, {
    componentPropertyDefinitions: definitions,
    componentPropertyAssignments: assignments
  })
  const copy = graph.createNode('FRAME', page, {
    componentPropertyDefinitions: definitions,
    componentPropertyAssignments: assignments
  })
  // Held, not copied: as a layer inside an instance holds its component layer's objects.
  const node = graph.getNode(copy.id)
  if (!node) throw new Error('Missing copy')
  node.componentPropertyDefinitions = definitions
  node.componentPropertyAssignments = assignments

  linkComponentPropertyValues(graph, new Map([['1:2', 'linked']]), [node])

  expect(node.componentPropertyDefinitions[0].defaultValue).toBe('linked')
  expect(node.componentPropertyAssignments.swap).toBe('linked')
  expect(definitions[0].defaultValue).toBe('1:2')
  expect(assignments.swap).toBe('1:2')
  expect(graph.getNode(component.id)?.componentPropertyAssignments.swap).toBe('1:2')
})
