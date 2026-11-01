import { describe, expect, test } from 'bun:test'

import {
  BOARD_TOOL_SHORTCUTS,
  createDefaultEditorState,
  createDocumentGraph,
  createEditor,
  resolveEditorProfile,
  TOOL_SHORTCUTS
} from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

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
      tools: null,
      toolKeys: TOOL_SHORTCUTS,
      snapGrid: 1,
      dotGrid: null,
      pixelGrid: true,
      framesOpen: true,
      lint: true,
      rulers: true,
      panelsOpen: true
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
      tools: null,
      toolKeys: TOOL_SHORTCUTS,
      snapGrid: 1,
      dotGrid: null,
      pixelGrid: true,
      framesOpen: true,
      lint: true,
      rulers: true,
      panelsOpen: true
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

describe('document kinds', () => {
  test("a board offers FigJam's tools and keys and snaps to its 16-unit grid", () => {
    const editor = createEditor()
    editor.setDocumentKind('board')
    const profile = resolveEditorProfile(editor.state)
    expect(profile.tools && [...profile.tools]).toEqual([
      'SELECT',
      'HAND',
      'STICKY',
      'SHAPE_WITH_TEXT',
      'CONNECTOR',
      'SECTION',
      'TEXT',
      'COMMENT'
    ])
    expect([profile.toolKeys, profile.snapGrid]).toEqual([BOARD_TOOL_SHORTCUTS, 16])
    // FigJam draws its dots every 16 units and has no pixel grid.
    const { dotGrid, pixelGrid, framesOpen, lint, rulers, panelsOpen } = profile
    expect([dotGrid, pixelGrid, framesOpen, lint, rulers, panelsOpen]).toEqual([
      16,
      false,
      false,
      false,
      false,
      false
    ])
  })

  test('becoming a board drops a design tool, and refuses picking one', () => {
    const editor = createEditor()
    editor.setTool('RECTANGLE')
    editor.setDocumentKind('board')
    expect(editor.state.activeTool).toBe('SELECT')
    editor.setTool('PEN')
    expect(editor.state.activeTool).toBe('SELECT')
    editor.setTool('STICKY')
    expect(editor.state.activeTool).toBe('STICKY')
  })

  test('the kind belongs to the document, so a replaced graph brings its own', () => {
    const editor = createEditor()
    editor.setDocumentKind('board')
    expect(editor.graph.documentKind).toBe('board')
    editor.replaceGraph(new SceneGraph())
    expect(editor.state.documentKind).toBe('design')
  })

  test('a board opened or swapped in with a design tool active gives way to Move', () => {
    const state = createDefaultEditorState(new SceneGraph().getPages()[0].id)
    state.activeTool = 'RECTANGLE'
    const opened = createEditor({ graph: createDocumentGraph('board', 'light'), state })
    expect(opened.state.activeTool).toBe('SELECT')

    const editor = createEditor()
    editor.setTool('PEN')
    editor.replaceGraph(createDocumentGraph('board', 'light'))
    expect(editor.state.activeTool).toBe('SELECT')
  })

  test('a read-only board keeps only Move and Hand of its tools', () => {
    const editor = createEditor()
    editor.setDocumentKind('board')
    editor.setReadOnly(true)
    const profile = resolveEditorProfile(editor.state)
    expect([profile.edits, profile.tools && [...profile.tools], profile.snapGrid]).toEqual([
      false,
      ['SELECT', 'HAND'],
      16
    ])
  })
})
