import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

describe('editor access mode', () => {
  test('defaults to owner access and reports mutation capability', () => {
    const editor = createEditor()
    expect(editor.state.accessMode).toBe('owner')
    expect(editor.canMutate()).toBe(true)
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
