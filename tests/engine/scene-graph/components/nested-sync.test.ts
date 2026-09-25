import { expect, test } from 'bun:test'

import {
  SceneGraph,
  recordInstanceOverride,
  deleteInstanceOverride
} from '@open-pencil/scene-graph'

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
