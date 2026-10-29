import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'
import { DEFAULT_HISTORY_LIMIT } from '@open-pencil/scene-graph/undo'

/**
 * A List component whose layer A an instance overrides, deleted, then `edits` other edits that
 * each remove copies of `componentsPerEdit` components, then A coming back, as undo brings it
 * back, with the same id. Returns whether the copy came back as it was.
 */
function restoreAfter(edits: number, componentsPerEdit = 1) {
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

  const others = Array.from({ length: componentsPerEdit }, () => {
    const other = graph.createNode('COMPONENT', page, { name: 'Other' })
    graph.createInstance(other.id, page)
    return other.id
  })
  for (let i = 0; i < edits; i++) {
    const layers = others.map((id) => graph.createNode('RECTANGLE', id))
    graph.syncInstancesTogether(others)
    for (const layer of layers) graph.deleteNode(layer.id)
    graph.syncInstancesTogether(others)
  }

  graph.createNodeWithId(a.id, 'TEXT', list.id, { name: 'A', text: 'a' })
  graph.syncInstances(list.id)
  const copy = graph.getChildren(instance.id)[0]
  return { sameCopy: copy.id === copyId, text: copy.text }
}

test('a removed copy comes back with its id and overrides while undo can still reach it', () => {
  expect(restoreAfter(DEFAULT_HISTORY_LIMIT - 1)).toEqual({ sameCopy: true, text: 'override' })
})

test('one edit that syncs several components takes one place in what undo can bring back', () => {
  expect(restoreAfter(DEFAULT_HISTORY_LIMIT - 1, 3)).toEqual({ sameCopy: true, text: 'override' })
})

test('a removed copy older than the undo history is forgotten, so the layer comes back fresh', () => {
  expect(restoreAfter(DEFAULT_HISTORY_LIMIT)).toEqual({ sameCopy: false, text: 'a' })
})
