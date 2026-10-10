import { expect, test } from 'bun:test'

import { DEFAULT_HISTORY_LIMIT, SceneGraph, setInstanceOverride } from '@open-pencil/scene-graph'

/**
 * A List component whose layer A an instance overrides, deleted, then `removals` other syncs
 * that each remove a copy, then A coming back as undo brings it back: with the same id.
 */
function restoreAfter(removals: number): string | undefined {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const list = graph.createNode('COMPONENT', page, { name: 'List' })
  const a = graph.createNode('TEXT', list.id, { name: 'A', text: 'a' })
  const instance = graph.createInstance(list.id, page)
  if (!instance) throw new Error('no instance')
  const [copyId] = instance.childIds
  graph.updateNode(copyId, { text: 'override' })
  setInstanceOverride(instance.instanceOverrides, instance.id, copyId, 'text', 'override')

  graph.deleteNode(a.id)
  graph.syncInstances(list.id)
  expect(instance.childIds).toEqual([])

  const other = graph.createNode('COMPONENT', page, { name: 'Other' })
  graph.createInstance(other.id, page)
  for (let i = 0; i < removals; i++) {
    const layer = graph.createNode('RECTANGLE', other.id)
    graph.syncInstances(other.id)
    graph.deleteNode(layer.id)
    graph.syncInstances(other.id)
  }

  graph.createNodeWithId(a.id, 'TEXT', list.id, { name: 'A', text: 'a' })
  graph.syncInstances(list.id)
  return graph.getChildren(instance.id)[0]?.text
}

test('a removed copy comes back with its overrides while undo can still reach it', () => {
  expect(restoreAfter(DEFAULT_HISTORY_LIMIT - 1)).toBe('override')
})

test('a removed copy older than the undo history is forgotten, so the layer comes back fresh', () => {
  expect(restoreAfter(DEFAULT_HISTORY_LIMIT)).toBe('a')
})
