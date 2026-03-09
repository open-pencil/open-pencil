import { describe, test, expect } from 'bun:test'

import { TextEditor, type SceneNode } from '@open-pencil/core'

const mockCk = {} as any

function createEditor(text = 'Hello World') {
  const editor = new TextEditor(mockCk)
  const node = { id: 'test-node', text } as SceneNode
  editor.start(node)
  return { editor, node }
}

describe('TextEditor', () => {
  test('start initializes state', () => {
    const { editor } = createEditor()
    expect(editor.isActive).toBe(true)
    expect(editor.nodeId).toBe('test-node')
    expect(editor.state?.text).toBe('Hello World')
    expect(editor.state?.cursor).toBe(11)
  })

  test('stop returns result and clears state', () => {
    const { editor } = createEditor()
    const result = editor.stop()
    expect(result?.nodeId).toBe('test-node')
    expect(result?.text).toBe('Hello World')
    expect(editor.isActive).toBe(false)
    expect(editor.nodeId).toBeNull()
  })

  test('stop on inactive returns null', () => {
    const editor = new TextEditor(mockCk)
    expect(editor.stop()).toBeNull()
  })

  test('insert at end', () => {
    const { editor, node } = createEditor()
    editor.insert('!', node)
    expect(editor.state?.text).toBe('Hello World!')
    expect(editor.state?.cursor).toBe(12)
  })

  test('insert at cursor position', () => {
    const { editor, node } = createEditor()
    editor.state!.cursor = 5
    editor.insert(' Beautiful', node)
    expect(editor.state?.text).toBe('Hello Beautiful World')
  })

  test('insert replaces selection', () => {
    const { editor, node } = createEditor()
    editor.state!.selectionAnchor = 0
    editor.state!.cursor = 5
    editor.insert('Goodbye', node)
    expect(editor.state?.text).toBe('Goodbye World')
    expect(editor.state?.cursor).toBe(7)
    expect(editor.state?.selectionAnchor).toBeNull()
  })

  test('backspace deletes char before cursor', () => {
    const { editor, node } = createEditor()
    editor.backspace(node)
    expect(editor.state?.text).toBe('Hello Worl')
    expect(editor.state?.cursor).toBe(10)
  })

  test('backspace at start does nothing', () => {
    const { editor, node } = createEditor()
    editor.state!.cursor = 0
    editor.backspace(node)
    expect(editor.state?.text).toBe('Hello World')
  })

  test('backspace deletes selection', () => {
    const { editor, node } = createEditor()
    editor.state!.selectionAnchor = 6
    editor.state!.cursor = 11
    editor.backspace(node)
    expect(editor.state?.text).toBe('Hello ')
    expect(editor.state?.cursor).toBe(6)
  })

  test('delete removes char after cursor', () => {
    const { editor, node } = createEditor()
    editor.state!.cursor = 0
    editor.delete(node)
    expect(editor.state?.text).toBe('ello World')
    expect(editor.state?.cursor).toBe(0)
  })

  test('delete at end does nothing', () => {
    const { editor, node } = createEditor()
    editor.delete(node)
    expect(editor.state?.text).toBe('Hello World')
  })

  test('delete removes selection', () => {
    const { editor, node } = createEditor()
    editor.state!.selectionAnchor = 0
    editor.state!.cursor = 5
    editor.delete(node)
    expect(editor.state?.text).toBe(' World')
  })

  test('moveLeft', () => {
    const { editor } = createEditor()
    editor.moveLeft()
    expect(editor.state?.cursor).toBe(10)
  })

  test('moveRight at end stays', () => {
    const { editor } = createEditor()
    editor.moveRight()
    expect(editor.state?.cursor).toBe(11)
  })

  test('moveLeft collapses selection to start', () => {
    const { editor } = createEditor()
    editor.state!.selectionAnchor = 3
    editor.state!.cursor = 8
    editor.moveLeft()
    expect(editor.state?.cursor).toBe(3)
    expect(editor.state?.selectionAnchor).toBeNull()
  })

  test('moveRight collapses selection to end', () => {
    const { editor } = createEditor()
    editor.state!.selectionAnchor = 3
    editor.state!.cursor = 8
    editor.moveRight()
    expect(editor.state?.cursor).toBe(8)
    expect(editor.state?.selectionAnchor).toBeNull()
  })

  test('selectAll', () => {
    const { editor } = createEditor()
    editor.selectAll()
    expect(editor.state?.selectionAnchor).toBe(0)
    expect(editor.state?.cursor).toBe(11)
  })

  test('hasSelection', () => {
    const { editor } = createEditor()
    expect(editor.hasSelection()).toBe(false)
    editor.state!.selectionAnchor = 0
    expect(editor.hasSelection()).toBe(true)
  })

  test('hasSelection false when anchor equals cursor', () => {
    const { editor } = createEditor()
    editor.state!.selectionAnchor = editor.state!.cursor
    expect(editor.hasSelection()).toBe(false)
  })

  test('getSelectionRange', () => {
    const { editor } = createEditor()
    expect(editor.getSelectionRange()).toBeNull()
    editor.state!.selectionAnchor = 8
    editor.state!.cursor = 3
    expect(editor.getSelectionRange()).toEqual([3, 8])
  })

  test('getSelectedText', () => {
    const { editor } = createEditor()
    editor.state!.selectionAnchor = 0
    editor.state!.cursor = 5
    expect(editor.getSelectedText()).toBe('Hello')
  })

  test('selectWord', () => {
    const { editor } = createEditor()
    editor.selectWord(2)
    expect(editor.state?.selectionAnchor).toBe(0)
    expect(editor.state?.cursor).toBe(5)
  })

  test('selectWord on second word', () => {
    const { editor } = createEditor()
    editor.selectWord(8)
    expect(editor.state?.selectionAnchor).toBe(6)
    expect(editor.state?.cursor).toBe(11)
  })

  test('moveWordLeft', () => {
    const { editor } = createEditor()
    editor.moveWordLeft()
    expect(editor.state?.cursor).toBe(6)
  })

  test('moveWordRight from start', () => {
    const { editor } = createEditor()
    editor.state!.cursor = 0
    editor.moveWordRight()
    expect(editor.state?.cursor).toBe(6)
  })

  test('moveLeft with extend creates selection', () => {
    const { editor } = createEditor()
    editor.state!.cursor = 5
    editor.moveLeft(true)
    expect(editor.state?.selectionAnchor).toBe(5)
    expect(editor.state?.cursor).toBe(4)
  })
})
