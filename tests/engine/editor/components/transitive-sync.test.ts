import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined } from '#tests/helpers/assert'

test('component edits propagate across definition dependencies and undo/redo', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const inner = graph.createNode('COMPONENT', page, { paddingLeft: 4 })
  const middle = graph.createNode('COMPONENT', page)
  const innerTemplate = expectDefined(graph.createInstance(inner.id, middle.id))
  const outer = graph.createNode('COMPONENT', page)
  const middleTemplate = expectDefined(graph.createInstance(middle.id, outer.id))
  const placed = expectDefined(graph.createInstance(outer.id, page))
  const placedMiddle = graph.getChildren(placed.id)[0]
  const placedInner = graph.getChildren(placedMiddle.id)[0]
  const editor = createEditor({ graph })
  editor.updateNodeWithUndo(middle.id, { paddingRight: 9 })
  editor.updateNodeWithUndo(inner.id, { paddingLeft: 12 })
  await Promise.resolve()
  expect(innerTemplate.paddingLeft).toBe(12)
  expect(graph.getChildren(middleTemplate.id)[0].paddingLeft).toBe(12)
  expect(placedInner.paddingLeft).toBe(12)
  expect(placedMiddle.paddingRight).toBe(9)
  expect(graph.getChildren(placedMiddle.id)).toHaveLength(1)
  editor.undo.undo()
  await Promise.resolve()
  expect(placedInner.paddingLeft).toBe(4)
  editor.undo.redo()
  await Promise.resolve()
  expect(placedInner.paddingLeft).toBe(12)
})
