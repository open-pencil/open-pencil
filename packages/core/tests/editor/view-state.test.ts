import { describe, expect, test } from 'bun:test'

import {
  copyEditorViewState,
  createDefaultEditorState,
  createEditor,
  createDefaultEditorViewState,
  pickEditorViewState
} from '@open-pencil/core/editor'

describe('editor state ownership', () => {
  test('composes editor state from shared and view defaults', () => {
    const state = createDefaultEditorState('page')
    const view = createDefaultEditorViewState('page')

    expect(pickEditorViewState(state)).toEqual(view)
    expect(state.activeTool).toBe('SELECT')
    expect(state.documentName).toBe('Untitled')
  })

  test('copies mutable view state for an independent canvas surface', () => {
    const state = createDefaultEditorState('page')
    state.selectedIds = new Set(['selected'])
    state.snapGuides = [{ axis: 'x', position: 10, from: 0, to: 20 }]
    const source = pickEditorViewState(state)
    const copy = copyEditorViewState(source)

    copy.selectedIds.add('pane-only')
    copy.snapGuides.length = 0
    copy.pageColor.r = 0.5
    copy.navigation.phase = 'zoom'

    expect(source.selectedIds).toEqual(new Set(['selected']))
    expect(source.snapGuides).toHaveLength(1)
    expect(source.pageColor.r).not.toBe(0.5)
    expect(source.navigation.phase).toBe('idle')
  })

  test('moves a text selection without counting as a document change', () => {
    const editor = createEditor()
    const { sceneVersion, canvasVersion, renderVersion } = editor.state
    editor.textSelectionChanged()
    expect(editor.state.textSelectionVersion).toBe(1)
    expect(editor.state.renderVersion).toBe(renderVersion + 1)
    // Saving, recovery, and the canvas's recorded pictures follow these; a caret moves none.
    expect(editor.state.sceneVersion).toBe(sceneVersion)
    expect(editor.state.canvasVersion).toBe(canvasVersion)
    editor.dispose()
  })
})
