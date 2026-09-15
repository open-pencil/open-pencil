import { describe, expect, test } from 'bun:test'

import { createEditor, type Editor, type Tool } from '@open-pencil/core/editor'

import { handleDrawMove, startShapeDraw, startTextDraw } from '#vue/shared/input/draw'
import type { DragState } from '#vue/shared/input/types'

function start(editor: Editor, tool: Tool = 'FRAME') {
  const state: { drag: DragState | null } = { drag: null }
  editor.setTool(tool)
  const setDrag = (drag: DragState) => {
    state.drag = drag
  }
  if (tool === 'TEXT') startTextDraw(100, 100, editor, setDrag)
  else startShapeDraw(100, 100, editor, setDrag)
  const drag = state.drag
  if (drag?.type !== 'draw') throw new Error('Expected drawing interaction')
  return drag
}

describe('draw creation previews', () => {
  test('is interactive immediately, previews geometry, and creates one undo step', () => {
    const editor = createEditor()
    try {
      const drag = start(editor)
      expect(editor.isInteractiveEditing()).toBe(true)
      const version = editor.state.sceneVersion
      let committed = 0
      editor.onEditorEvent('node:updated', () => {
        committed++
      })
      handleDrawMove(drag, 180, 150, false)
      handleDrawMove(drag, 220, 170, false)
      expect(editor.graph.getNode(drag.nodeId)).toMatchObject({
        x: 100,
        y: 100,
        width: 120,
        height: 70
      })
      expect(editor.state.sceneVersion).toBe(version)
      expect(committed).toBe(0)
      expect(editor.undo.canUndo).toBe(false)
      drag.commit()
      expect(editor.isInteractiveEditing()).toBe(false)
      expect(editor.undo.isBatching).toBe(false)
      expect(editor.state.activeTool).toBe('SELECT')
      editor.undoAction()
      expect(editor.graph.getNode(drag.nodeId)).toBeUndefined()
      expect(editor.undo.canUndo).toBe(false)
      editor.redoAction()
      expect(editor.graph.getNode(drag.nodeId)).toMatchObject({ width: 120, height: 70 })
      drag.cancel()
      expect(editor.graph.getNode(drag.nodeId)).toBeDefined()
    } finally {
      editor.dispose()
    }
  })

  test('cancel removes the provisional node, releases history, and ignores trailing input', () => {
    const editor = createEditor()
    try {
      const drag = start(editor)
      handleDrawMove(drag, 50, 70, true)
      expect(editor.graph.getNode(drag.nodeId)).toMatchObject({
        x: 50,
        y: 50,
        width: 50,
        height: 50
      })
      drag.cancel()
      drag.cancel()
      handleDrawMove(drag, 250, 250, false)
      drag.commit()
      expect(editor.graph.getNode(drag.nodeId)).toBeUndefined()
      expect(editor.undo.isBatching).toBe(false)
      expect(editor.undo.canUndo).toBe(false)
      expect(editor.isInteractiveEditing()).toBe(false)
    } finally {
      editor.dispose()
    }
  })

  test('click defaults and text box sizing survive the preview transaction', () => {
    for (const tool of ['FRAME', 'TEXT'] as const) {
      const editor = createEditor()
      try {
        const drag = start(editor, tool)
        drag.commit()
        const node = editor.graph.getNode(drag.nodeId)
        if (tool === 'FRAME') expect(node).toMatchObject({ width: 100, height: 100 })
        else expect(node).toMatchObject({ text: '', textAutoResize: 'WIDTH_AND_HEIGHT' })
        expect(editor.isInteractiveEditing()).toBe(false)
        expect(editor.undo.isBatching).toBe(false)
      } finally {
        editor.dispose()
      }
    }
    const editor = createEditor()
    try {
      const drag = start(editor, 'TEXT')
      handleDrawMove(drag, 300, 180, false)
      drag.commit()
      expect(editor.graph.getNode(drag.nodeId)).toMatchObject({
        width: 200,
        height: 80,
        textAutoResize: 'NONE'
      })
    } finally {
      editor.dispose()
    }
  })

  test('section adoption is included in the creation undo step', () => {
    const editor = createEditor()
    try {
      const page = editor.state.currentPageId
      const child = editor.graph.createNode('RECTANGLE', page, {
        x: 120,
        y: 120,
        width: 20,
        height: 20
      })
      const drag = start(editor, 'SECTION')
      handleDrawMove(drag, 300, 300, false)
      drag.commit()
      expect(child.parentId).toBe(drag.nodeId)
      editor.undoAction()
      expect(child.parentId).toBe(page)
      expect(child.x).toBe(120)
      expect(editor.graph.getNode(drag.nodeId)).toBeUndefined()
      expect(editor.undo.canUndo).toBe(false)
      editor.redoAction()
      expect(child.parentId).toBe(drag.nodeId)
      expect(editor.graph.getNode(drag.nodeId)?.width).toBe(200)
    } finally {
      editor.dispose()
    }
  })
})
