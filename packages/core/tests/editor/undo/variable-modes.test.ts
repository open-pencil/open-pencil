import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

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
})
