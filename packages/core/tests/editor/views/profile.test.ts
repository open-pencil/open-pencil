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
      leaveTo: null,
      edits: true,
      tools: null
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
      leaveTo: { id: 'edit' },
      edits: true,
      tools: null
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

describe('host restrictions', () => {
  test('a read-only document offers no edits and keeps Move and Hand in every view', () => {
    const editor = createEditor()
    editor.setReadOnly(true)
    const editing = resolveEditorProfile(editor.state)
    expect([editing.edits, editing.tools && [...editing.tools]]).toEqual([
      false,
      ['SELECT', 'HAND']
    ])
    editor.startPlay()
    const previewing = resolveEditorProfile(editor.state)
    expect([previewing.edits, previewing.pointer, previewing.live]).toEqual([
      false,
      'pan',
      { revision: 0 }
    ])
    expect(previewing.tools && [...previewing.tools]).toEqual(['SELECT', 'HAND'])
  })

  test('going read-only drops a tool it does not offer, and refuses picking one', () => {
    const editor = createEditor()
    editor.setTool('RECTANGLE')
    editor.setReadOnly(true)
    expect(editor.state.activeTool).toBe('SELECT')
    editor.setTool('FRAME')
    expect(editor.state.activeTool).toBe('SELECT')
    editor.setTool('HAND')
    expect(editor.state.activeTool).toBe('HAND')
  })

  test('lifting the restriction gives the view its own profile back', () => {
    const editor = createEditor()
    editor.setReadOnly(true)
    editor.setReadOnly(false)
    expect(resolveEditorProfile(editor.state)).toMatchObject({ edits: true, tools: null })
  })
})
