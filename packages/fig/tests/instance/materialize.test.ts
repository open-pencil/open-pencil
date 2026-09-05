import { expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'
import { materializeInstance } from '#fig/instance-overrides/materialize-instance'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import fixture from './fixtures/accordion-source-closure.json'

function setup() {
  const occurrence = interpretInstance(fixture as NodeChange[], '7:283', {
    onUnresolvedProperty: (diagnostic) => {
      expect(diagnostic.reason).toBe('missing-target')
    }
  })
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const components = new Map<string, string>()
  function visit(node: typeof occurrence): void {
    if (node.mainComponentId && !components.has(node.mainComponentId)) {
      components.set(node.mainComponentId, graph.createNode('COMPONENT', page.id).id)
    }
    node.children.forEach(visit)
  }
  visit(occurrence)
  return { occurrence, graph, page, components }
}

test('materializes separate occurrence nodes with direct component identities and resolved text', () => {
  const { occurrence, graph, page, components } = setup()
  const result = materializeInstance(graph, page.id, occurrence, components)
  expect(result.root.type).toBe('INSTANCE')
  expect(result.root.componentId).toBe(components.get('7:186'))
  const labels = [...result.nodes].filter(([source]) => source.sourceId === '4:483')
  expect(labels).toHaveLength(2)
  expect(labels.map(([, node]) => node.text)).toEqual(['Is it styled?', 'Is it animated?'])
  expect(labels[0][1].id).not.toBe(labels[1][1].id)
  expect(graph.getChildren(result.root.id).map((node) => node.componentId)).toEqual([
    components.get('7:251'),
    components.get('7:156'),
    components.get('7:156')
  ])
  for (const node of result.nodes.values()) expect(node.source.id).toBeNull()
})

test('rejects an invalid late descendant without creating a partial tree', () => {
  const { occurrence, graph, page, components } = setup()
  occurrence.children[2].properties.type = 'DOCUMENT'
  const count = graph.nodes.size
  expect(() => materializeInstance(graph, page.id, occurrence, components)).toThrow(
    'Cannot materialize DOCUMENT'
  )
  expect(graph.nodes.size).toBe(count)
})

test('rejects cyclic occurrence input before mutating the destination', () => {
  const { occurrence, graph, page, components } = setup()
  occurrence.children.push(occurrence)
  const count = graph.nodes.size
  expect(() => materializeInstance(graph, page.id, occurrence, components)).toThrow(
    'Repeated or cyclic'
  )
  expect(graph.nodes.size).toBe(count)
})

test('rejects missing components before creating occurrence nodes', () => {
  const { occurrence, graph, page } = setup()
  const count = graph.nodes.size
  expect(() => materializeInstance(graph, page.id, occurrence, new Map())).toThrow(
    'Missing materialized component'
  )
  expect(graph.nodes.size).toBe(count)
})
