import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

describe('selection semantics', () => {
  test('selectInverse selects unselected top-level layers', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, { name: 'First' })
    const second = editor.graph.createNode('RECTANGLE', pageId, { name: 'Second' })
    const third = editor.graph.createNode('RECTANGLE', pageId, { name: 'Third' })
    editor.select([second.id])

    editor.selectInverse()

    expect(editor.state.selectedIds).toEqual(new Set([first.id, third.id]))
  })

  test('renameSelected applies one name and supports undo', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, { name: 'First' })
    const second = editor.graph.createNode('ELLIPSE', pageId, { name: 'Second' })
    editor.select([first.id, second.id])

    editor.renameSelected('Shared name')
    expect(editor.graph.getNode(first.id)?.name).toBe('Shared name')
    expect(editor.graph.getNode(second.id)?.name).toBe('Shared name')

    editor.undoAction()
    expect(editor.graph.getNode(first.id)?.name).toBe('First')
    expect(editor.graph.getNode(second.id)?.name).toBe('Second')
  })

  test('renameSelected restores default names for blank input', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const rectangle = editor.graph.createNode('RECTANGLE', pageId, { name: 'Custom' })
    const text = editor.graph.createNode('TEXT', pageId, { name: 'Copy' })
    editor.select([rectangle.id, text.id])

    editor.renameSelected('  ')

    expect(editor.graph.getNode(rectangle.id)?.name).toBe('Rectangle')
    expect(editor.graph.getNode(text.id)?.name).toBe('Text')
  })
})
