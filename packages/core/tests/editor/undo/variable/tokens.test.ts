import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function themeEditor() {
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
  editor.graph.addVariable({
    id: 'gutter',
    name: 'Gutter',
    type: 'FLOAT',
    collectionId: 'theme',
    valuesByMode: { light: 24, dark: 24 },
    description: '',
    hiddenFromPublishing: false
  })
  return editor
}

describe('variable token undo', () => {
  test('token fields change together and undo restores them', () => {
    const editor = themeEditor()
    const gutter = () => editor.graph.variables.get('gutter')

    editor.updateVariableToken('gutter', {
      unit: 'rem',
      scopes: ['GAP'],
      expressions: { light: { css: 'clamp(1rem, 4vw, 1.5rem)', resolved: 24 } },
      description: 'Space between cards'
    })
    expect(gutter()).toMatchObject({
      unit: 'rem',
      scopes: ['GAP'],
      expressions: { light: { css: 'clamp(1rem, 4vw, 1.5rem)', resolved: 24 } },
      description: 'Space between cards'
    })

    editor.undo.undo()
    expect(gutter()?.unit).toBeUndefined()
    expect(gutter()?.scopes).toBeUndefined()
    expect(gutter()?.expressions).toBeUndefined()
    expect(gutter()?.description).toBe('')

    editor.undo.redo()
    expect(gutter()?.unit).toBe('rem')
  })

  test('clearing a field leaves the others and keeps a description', () => {
    const editor = themeEditor()
    editor.updateVariableToken('gutter', { unit: 'rem', description: 'Gap' })

    editor.updateVariableToken('gutter', { unit: undefined, description: undefined })

    expect(editor.graph.variables.get('gutter')).toMatchObject({ description: '' })
    expect(editor.graph.variables.get('gutter')?.unit).toBeUndefined()
  })

  test('a mode condition is set, cleared by an empty value, and undone', () => {
    const editor = themeEditor()
    const dark = () =>
      editor.graph.variableCollections.get('theme')?.modes.find((mode) => mode.modeId === 'dark')

    editor.setModeCondition('theme', 'dark', '  @media (prefers-color-scheme: dark)  ')
    expect(dark()?.condition).toBe('@media (prefers-color-scheme: dark)')

    editor.setModeCondition('theme', 'dark', '')
    expect(dark()?.condition).toBeUndefined()

    editor.undo.undo()
    expect(dark()?.condition).toBe('@media (prefers-color-scheme: dark)')
    editor.undo.undo()
    expect(dark()?.condition).toBeUndefined()
  })

  test('hiding from publishing is a token field and undoes with the others', () => {
    const editor = themeEditor()

    editor.updateVariableToken('gutter', { hiddenFromPublishing: true })
    expect(editor.graph.variables.get('gutter')?.hiddenFromPublishing).toBe(true)

    editor.undo.undo()
    expect(editor.graph.variables.get('gutter')?.hiddenFromPublishing).toBe(false)
  })

  test('a duplicate copies every field, sits after the original, and undoes', () => {
    const editor = themeEditor()
    editor.updateVariableToken('gutter', { unit: 'rem', scopes: ['GAP'] })

    const copyId = editor.duplicateVariable('gutter', 'Gutter copy')
    if (!copyId) throw new Error('the variable was not duplicated')
    const copy = editor.graph.variables.get(copyId)

    expect(copy).toMatchObject({
      name: 'Gutter copy',
      unit: 'rem',
      scopes: ['GAP'],
      valuesByMode: { light: 24, dark: 24 }
    })
    expect(editor.graph.variableCollections.get('theme')?.variableIds).toEqual(['gutter', copyId])

    editor.undo.undo()
    expect(editor.graph.variables.has(copyId)).toBe(false)
    editor.undo.redo()
    expect(editor.graph.variableCollections.get('theme')?.variableIds).toEqual(['gutter', copyId])
  })

  test('reordering variables is one undo step', () => {
    const editor = themeEditor()
    const other = editor.graph.createVariable('Other', 'FLOAT', 'theme', 4)
    const order = () => editor.graph.variableCollections.get('theme')?.variableIds

    editor.setVariableOrder('theme', [other.id, 'gutter'])
    expect(order()).toEqual([other.id, 'gutter'])

    editor.undo.undo()
    expect(order()).toEqual(['gutter', other.id])
  })
})
