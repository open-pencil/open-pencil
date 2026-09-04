import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

describe('editor access mode', () => {
  test('defaults to owner access and reports mutation capability', () => {
    const editor = createEditor()
    expect(editor.state.accessMode).toBe('owner')
    expect(editor.canMutate()).toBe(true)
    editor.dispose()
  })

  test('rejects shape creation in view mode without mutating the graph', () => {
    const editor = createEditor()
    const initialSize = editor.graph.nodes.size
    editor.setAccessMode('view')
    expect(() => editor.createShape('RECTANGLE', 0, 0, 10, 10)).toThrow('Document is read-only')
    expect(editor.graph.nodes.size).toBe(initialSize)
    editor.dispose()
  })

  test('limits view-only sessions to navigation and selection tools', () => {
    const editor = createEditor()
    editor.setAccessMode('view')
    expect(editor.canMutate()).toBe(false)
    expect(editor.state.activeTool).toBe('SELECT')

    editor.setTool('RECTANGLE')
    expect(editor.state.activeTool).toBe('SELECT')
    editor.setTool('HAND')
    expect(editor.state.activeTool).toBe('HAND')

    editor.setAccessMode('edit')
    editor.setTool('RECTANGLE')
    expect(editor.canMutate()).toBe(true)
    expect(editor.state.activeTool).toBe('RECTANGLE')
    editor.dispose()
  })
})
