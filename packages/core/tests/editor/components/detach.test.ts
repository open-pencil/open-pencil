import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'

test('undoing a detach gives the instances it held back the overrides they had', () => {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const tag = editor.graph.createNode('COMPONENT', page, { name: 'Tag' })
  editor.graph.createNode('TEXT', tag.id, { name: 'Label', text: 'Tag' })
  const card = editor.graph.createNode('COMPONENT', page, { name: 'Card' })
  const nested = editor.graph.createInstance(tag.id, card.id)
  if (!nested) throw new Error('No nested tag')
  const [nestedLabel] = editor.graph.getChildren(nested.id)
  editor.graph.updateNode(nestedLabel.id, { text: 'Práctica guiada' })
  recordInstanceOverride(editor.graph, nestedLabel.id, ['text'])
  const instance = editor.graph.createInstance(card.id, page)
  if (!instance) throw new Error('No instance')
  const [tagCopy] = editor.graph.getChildren(instance.id)
  const [label] = editor.graph.getChildren(tagCopy.id)
  const overriddenLayers = () => [...(editor.graph.getNode(tagCopy.id)?.instanceOverrides.descendants.keys() ?? [])]
  const copied = overriddenLayers()

  editor.select([instance.id])
  editor.detachInstance()
  expect(overriddenLayers()).toEqual([label.id])

  editor.undoAction()
  expect(editor.graph.getNode(instance.id)?.type).toBe('INSTANCE')
  expect(overriddenLayers()).toEqual(copied)

  editor.redoAction()
  expect(editor.graph.getNode(instance.id)?.type).toBe('FRAME')
  expect(overriddenLayers()).toEqual([label.id])
})
