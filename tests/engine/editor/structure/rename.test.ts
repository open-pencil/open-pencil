import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { getNodeOrThrow } from '#tests/helpers/assert'

describe('renameNode', () => {
  function setup() {
    const editor = createEditor()
    const pageId = editor.graph.getPages()[0].id
    const frame = editor.graph.createNode('FRAME', pageId, {
      name: 'Original',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    return { editor, frame }
  }

  test('renames a node', () => {
    const { editor, frame } = setup()

    editor.renameNode(frame.id, 'My Frame')
    expect(getNodeOrThrow(editor.graph, frame.id).name).toBe('My Frame')
  })

  test('trims whitespace', () => {
    const { editor, frame } = setup()

    editor.renameNode(frame.id, '  Spaced  ')
    expect(getNodeOrThrow(editor.graph, frame.id).name).toBe('Spaced')
  })

  test('falls back to default name when empty', () => {
    const { editor, frame } = setup()

    editor.renameNode(frame.id, '   ')
    expect(getNodeOrThrow(editor.graph, frame.id).name).toBe('Frame')
  })

  test('is undoable', () => {
    const { editor, frame } = setup()

    editor.renameNode(frame.id, 'New Name')
    expect(editor.undo.canUndo).toBe(true)

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, frame.id).name).toBe('Original')

    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, frame.id).name).toBe('New Name')
  })

  test('no-op when name is unchanged', () => {
    const { editor, frame } = setup()

    editor.renameNode(frame.id, 'Original')
    expect(editor.undo.canUndo).toBe(false)
  })

  test('no-op when node does not exist', () => {
    const { editor } = setup()

    editor.renameNode('nonexistent-id', 'Test')
    expect(editor.undo.canUndo).toBe(false)
  })
})
