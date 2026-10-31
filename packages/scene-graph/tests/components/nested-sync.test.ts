import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { deleteInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

test('outer sync preserves a nested edit without blocking sibling or other-field inheritance', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const inner = graph.createNode('COMPONENT', page.id)
  graph.createNode('TEXT', inner.id, { text: 'Default', opacity: 1 })
  const outer = graph.createNode('COMPONENT', page.id)
  const nestedSource = graph.createInstance(inner.id, outer.id)
  const first = graph.createInstance(outer.id, page.id)
  const second = graph.createInstance(outer.id, page.id)
  if (!nestedSource || !first || !second) throw new Error('Missing instances')
  const firstNested = graph.getChildren(first.id)[0]
  const firstText = graph.getChildren(firstNested.id)[0]
  const secondText = graph.getChildren(graph.getChildren(second.id)[0].id)[0]
  const sourceText = graph.getChildren(nestedSource.id)[0]
  graph.updateNode(firstText.id, { text: 'Local edit' })
  recordInstanceOverride(graph, firstText.id, ['text'])
  graph.updateNode(sourceText.id, { text: 'Component edit', opacity: 0.5 })
  graph.syncInstances(outer.id)
  expect(firstText.text).toBe('Local edit')
  expect(firstText.opacity).toBe(0.5)
  expect(secondText.text).toBe('Component edit')
  expect(graph.getChildren(firstNested.id)).toHaveLength(1)

  deleteInstanceOverride(firstNested.instanceOverrides, firstNested.id, firstText.id, 'text')
  graph.syncInstances(outer.id)
  expect(firstText.text).toBe('Component edit')
})

test('outer sync preserves a nested label override over its badge text assignment', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const badge = graph.createNode('COMPONENT', page.id, {
    componentPropertyDefinitions: [
      { id: 'badge-label', name: 'Label', type: 'TEXT', defaultValue: 'Default' }
    ]
  })
  graph.createNode('TEXT', badge.id, {
    text: 'Default',
    componentPropertyReferences: [{ propertyId: 'badge-label', field: 'TEXT' }]
  })
  const card = graph.createNode('COMPONENT', page.id)
  const sourceBadge = graph.createInstance(badge.id, card.id, {
    componentPropertyAssignments: { 'badge-label': 'Multiplier' }
  })
  const instance = graph.createInstance(card.id, page.id)
  const sibling = graph.createInstance(card.id, page.id)
  if (!sourceBadge || !instance || !sibling) throw new Error('Missing instances')
  const nested = graph.getChildren(instance.id)[0]
  const label = graph.getChildren(nested.id)[0]
  const siblingLabel = graph.getChildren(graph.getChildren(sibling.id)[0].id)[0]
  graph.updateNode(label.id, { text: 'Bonus amount' })
  recordInstanceOverride(graph, label.id, ['text'])
  graph.updateNode(graph.getChildren(badge.id)[0].id, { opacity: 0.5 })

  for (const component of [card, badge, card]) {
    graph.syncInstances(component.id)
    expect(label.text).toBe('Bonus amount')
    expect(siblingLabel.text).toBe('Multiplier')
  }
  expect(label.opacity).toBe(0.5)
  deleteInstanceOverride(nested.instanceOverrides, nested.id, label.id, 'text')
  graph.syncInstances(card.id)
  expect(label.text).toBe('Multiplier')
})
