import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'

import { createTextListActions, listTypeOf } from '#vue/canvas/text-edit/lists'

let editor: Editor

afterEach(() => editor.dispose())

function textWithList() {
  editor = createEditor()
  const node = editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'Intro\nOne\nTwo',
    textParagraphs: [
      { listType: 'NONE', indentation: 0 },
      { listType: 'UNORDERED', indentation: 1 }
    ]
  })
  const read = () => editor.graph.getNode(node.id) ?? node
  return { node, read, lists: createTextListActions(editor) }
}

describe('text list actions', () => {
  test('change the whole text outside editing, in one undo step', () => {
    const { read, lists } = textWithList()
    expect(listTypeOf(editor, read())).toBeNull()

    lists.setListType(read(), 'ORDERED')
    expect(listTypeOf(editor, read())).toBe('ORDERED')
    expect(read().textParagraphs).toHaveLength(3)

    editor.undoAction()
    expect(read().textParagraphs.map((style) => style.listType)).toEqual(['NONE', 'UNORDERED'])
  })

  test('leave a change made while editing to the edit\'s own undo step', () => {
    const { node, read, lists } = textWithList()
    editor.state.editingTextId = node.id
    lists.setListType(read(), 'ORDERED')
    expect(listTypeOf(editor, read())).toBe('ORDERED')
    expect(editor.undo.canUndo).toBe(false)
  })

  test('toggle a list shortcut off when the text already is that list', () => {
    const { read, lists } = textWithList()
    lists.toggleListType(read(), 'UNORDERED')
    expect(listTypeOf(editor, read())).toBe('UNORDERED')
    lists.toggleListType(read(), 'UNORDERED')
    expect(read().textParagraphs).toEqual([])
  })

  test('nest list items only, and leave Tab to plain text', () => {
    const { read, lists } = textWithList()
    lists.setListType(read(), 'NONE')
    expect(lists.changeIndentation(read(), 1)).toBe(false)

    lists.setListType(read(), 'UNORDERED')
    expect(lists.changeIndentation(read(), 1)).toBe(true)
    expect(read().textParagraphs.map((style) => style.indentation)).toEqual([2, 2, 2])
  })
})
