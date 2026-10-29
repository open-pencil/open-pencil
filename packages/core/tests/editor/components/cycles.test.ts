import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'

/** Button holds an Inner frame; Card shows a Button. */
function setup() {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const button = editor.graph.createNode('COMPONENT', page, { name: 'Button' })
  const inner = editor.graph.createNode('FRAME', button.id, { name: 'Inner' })
  const card = editor.graph.createNode('COMPONENT', page, { name: 'Card' })
  editor.graph.createInstance(button.id, card.id)
  const instance = expectDefined(editor.graph.createInstance(card.id, page))
  return { editor, page, button, inner, card, instance }
}

test('moving a layer where its component would contain itself leaves it in place', () => {
  const { editor, page, button, inner, instance } = setup()
  editor.reparentNodes([instance.id], inner.id)
  expect(instance.parentId).toBe(page)
  expect(button.childIds).toEqual([inner.id])
})

test('placing an instance inside its own component creates nothing', () => {
  const { editor, card, inner } = setup()
  const before = editor.graph.nodes.size
  expect(editor.createInstanceFromComponent(card.id, 0, 0, inner.id)).toBeNull()
  expect(editor.graph.nodes.size).toBe(before)
  expect(editor.undo.canUndo).toBe(false)
})

test('the plugin API rejects a move that creates a component cycle, as Figma does', () => {
  const { editor, inner, instance } = setup()
  const figma = new FigmaAPI(editor.graph)
  const parent = expectDefined(figma.getNodeById(inner.id))
  const child = expectDefined(figma.getNodeById(instance.id))
  // Message recorded in Figma.
  expect(() => parent.appendChild(child)).toThrow(
    'in appendChild: Cannot move node. Reparenting would create a component cycle'
  )
  expect(() => parent.insertChild(0, child)).toThrow(
    'in insertChild: Cannot move node. Reparenting would create a component cycle'
  )
})
