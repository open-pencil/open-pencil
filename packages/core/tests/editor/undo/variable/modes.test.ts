import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

describe('variable mode undo', () => {
  test('setting a default mode moves it first, and undo restores the order', () => {
    const editor = createEditor()
    editor.graph.addCollection({
      id: 'theme',
      name: 'Theme',
      modes: [
        { modeId: 'light', name: 'Light' },
        { modeId: 'dim', name: 'Dim' },
        { modeId: 'dark', name: 'Dark' }
      ],
      defaultModeId: 'light',
      variableIds: []
    })
    const order = () => editor.graph.variableCollections.get('theme')?.modes.map((m) => m.modeId)

    editor.setDefaultMode('theme', 'dark')
    expect(order()).toEqual(['dark', 'light', 'dim'])
    expect(editor.graph.variableCollections.get('theme')?.defaultModeId).toBe('dark')

    editor.undo.undo()
    expect(order()).toEqual(['light', 'dim', 'dark'])
    expect(editor.graph.variableCollections.get('theme')?.defaultModeId).toBe('light')

    editor.undo.redo()
    expect(order()).toEqual(['dark', 'light', 'dim'])
  })

  test('undo restores the default mode of a collection restored by an earlier undo', () => {
    const editor = createEditor()
    editor.graph.addCollection({
      id: 'theme',
      name: 'Theme',
      modes: [
        { modeId: 'light', name: 'Light' },
        { modeId: 'dark', name: 'Dark' }
      ],
      defaultModeId: 'light',
      variableIds: []
    })
    editor.setDefaultMode('theme', 'dark')
    editor.removeCollection('theme')

    // Undoing the removal restores a copy of the collection, not the object it had before.
    editor.undo.undo()
    editor.undo.undo()

    const restored = editor.graph.variableCollections.get('theme')
    expect(restored?.defaultModeId).toBe('light')
    expect(restored?.modes.map((m) => m.modeId)).toEqual(['light', 'dark'])
  })

  test('undoing a collection’s removal shows the mode it showed', () => {
    const editor = createEditor()
    editor.graph.addCollection({
      id: 'theme',
      name: 'Theme',
      modes: [
        { modeId: 'light', name: 'Light' },
        { modeId: 'dark', name: 'Dark' }
      ],
      defaultModeId: 'light',
      variableIds: []
    })
    editor.setActiveMode('theme', 'dark')
    editor.removeCollection('theme')

    editor.undo.undo()
    expect(editor.graph.activeMode.get('theme')).toBe('dark')
  })

  test('undoing the removal of the mode on show shows it again', () => {
    const editor = createEditor()
    editor.graph.addCollection({
      id: 'theme',
      name: 'Theme',
      modes: [
        { modeId: 'light', name: 'Light' },
        { modeId: 'dark', name: 'Dark' }
      ],
      defaultModeId: 'light',
      variableIds: []
    })
    editor.setActiveMode('theme', 'dark')
    editor.removeMode('theme', 'dark')
    expect(editor.graph.activeMode.get('theme')).toBe('light')

    editor.undo.undo()
    expect(editor.graph.activeMode.get('theme')).toBe('dark')
    editor.undo.redo()
    expect(editor.graph.activeMode.get('theme')).toBe('light')
  })
})
