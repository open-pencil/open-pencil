import { describe, expect, test } from 'bun:test'

import { createEditor, resolveEditorProfile } from '@open-pencil/core'

describe('canvas view profiles', () => {
  test('an editing canvas takes every tool and shortcut and draws its chrome', () => {
    const editor = createEditor()
    expect(resolveEditorProfile(editor.state)).toEqual({
      pointer: 'tools',
      shortcuts: 'all',
      editChrome: true,
      live: null,
      panels: true,
      leaveTo: null
    })
  })

  test('a preview only pans, keeps view shortcuts, and runs its controls live', () => {
    const editor = createEditor()
    editor.startPlay()
    expect(resolveEditorProfile(editor.state)).toEqual({
      pointer: 'pan',
      shortcuts: 'view',
      editChrome: false,
      live: { revision: 0 },
      panels: false,
      leaveTo: { id: 'edit' }
    })
  })

  test('resetting a preview starts its live run afresh', () => {
    const editor = createEditor()
    editor.startPlay()
    editor.resetPlay()
    expect(resolveEditorProfile(editor.state).live).toEqual({ revision: 1 })
  })

  test('leaving a preview returns to editing; an editing canvas has nothing to leave', () => {
    const editor = createEditor()
    expect(editor.leaveCanvasView()).toBe(false)
    editor.startPlay()
    expect(editor.leaveCanvasView()).toBe(true)
    expect(editor.state.canvasView).toEqual({ id: 'edit' })
  })

  test('a read-only document can still preview and leave it', () => {
    const editor = createEditor()
    editor.setReadOnly(true)
    editor.startPlay()
    expect(editor.leaveCanvasView()).toBe(true)
  })
})
