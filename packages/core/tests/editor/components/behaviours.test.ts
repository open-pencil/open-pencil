import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { emptyBehaviour, readBehaviour } from '@open-pencil/scene-graph'

describe('setBehaviour', () => {
  test('adds, edits, and removes as single undo steps', () => {
    const editor = createEditor()
    const set = editor.graph.createNode('COMPONENT_SET', editor.state.currentPageId, { name: 'Switch' })
    editor.setBehaviour(set.id, emptyBehaviour('switch'))
    expect(editor.undo.undoLabel).toBe('Add behaviour')
    editor.setBehaviour(set.id, { ...emptyBehaviour('switch'), parts: { thumb: 'x' } })
    expect(editor.undo.undoLabel).toBe('Edit behaviour')
    editor.setBehaviour(set.id, null)
    expect(readBehaviour(editor.graph.getNode(set.id) ?? set)).toBeNull()

    editor.undo.undo()
    expect(readBehaviour(editor.graph.getNode(set.id) ?? set)?.parts).toEqual({ thumb: 'x' })
    editor.undo.undo()
    editor.undo.undo()
    expect(readBehaviour(editor.graph.getNode(set.id) ?? set)).toBeNull()
  })
})
