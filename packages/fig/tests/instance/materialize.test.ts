import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import {
  interpretComponent,
  interpretInstance,
  type MissingComponentDiagnostic
} from '#fig/instance-overrides/interpret'
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

test('materialization does not share editable paint payloads with interpreted occurrences', () => {
  const { occurrence, graph, page, components } = setup()
  occurrence.properties.fillPaints = [
    {
      type: 'SOLID',
      color: { r: 1, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true
    }
  ]
  const before = structuredClone(occurrence)
  const first = materializeInstance(graph, page.id, occurrence, components)
  const second = materializeInstance(graph, page.id, occurrence, components)
  const fill = first.root.fills[0]
  if (!fill?.color) throw new Error('Missing materialized fill')
  fill.color.r = 0
  expect(second.root.fills[0].color?.r).toBe(1)
  expect(occurrence).toEqual(before)
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

// Figma keeps an instance whose main component was deleted, with its saved reference.
test('an instance of a deleted component stays a childless instance when acknowledged', () => {
  const changes = [
    { guid: guid(1, 4), type: 'SYMBOL' },
    {
      guid: guid(2, 4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1, 4), position: '!' },
      name: 'Orphan',
      size: { x: 10, y: 10 },
      symbolData: {
        symbolID: guid(9, 4),
        symbolOverrides: [{ guidPath: { guids: [guid(8, 4)] }, opacity: 0.5 }]
      }
    }
  ] as NodeChange[]
  expect(() => interpretComponent(changes, '4:1')).toThrow('Missing source node 4:9')
  const missing: MissingComponentDiagnostic[] = []
  const component = interpretComponent(changes, '4:1', {
    onMissingComponent: (diagnostic) => missing.push(diagnostic)
  })
  expect(missing).toEqual([{ ownerId: '4:2', componentId: '4:9' }])
  const orphan = component.children[0]
  expect(orphan.mainComponentId).toBeNull()
  expect(orphan.children).toEqual([])
  expect(orphan.properties.symbolData?.symbolID).toEqual(guid(9, 4))
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const materialized = materializeInstance(graph, page.id, component, new Map())
  const node = graph.getChildren(materialized.root.id)[0]
  expect(node.type).toBe('INSTANCE')
  expect(node.componentId).toBeNull()
  expect(node.childIds).toEqual([])
})
