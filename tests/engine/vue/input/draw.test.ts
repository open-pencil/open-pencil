import { describe, expect, test } from 'bun:test'

import { createEditor, type Editor, type Tool } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'

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
  // Figma desktop 126: dragging from (3.3, 50.4) to (30.7, 71.8) draws 28 × 22 at (3, 50).
  test('rounds both corners to whole pixels while snapping to the pixel grid', () => {
    for (const [pixelGrid, expected] of [
      [true, { x: 3, y: 50, width: 28, height: 22 }],
      [false, { x: 3.3, y: 50.4 }]
    ] as const) {
      const editor = createEditor()
      try {
        editor.state.snappingPreferences = { geometry: true, objects: true, pixelGrid }
        editor.setTool('RECTANGLE')
        const state: { drag: DragState | null } = { drag: null }
        startShapeDraw(3.3, 50.4, editor, (drag) => {
          state.drag = drag
        })
        const drag = state.drag
        if (drag?.type !== 'draw') throw new Error('Expected drawing interaction')
        handleDrawMove(drag, 30.7, 71.8, false)
        drag.commit()
        const node = editor.graph.getNode(drag.nodeId)
        expect(node).toMatchObject(expected)
        if (!pixelGrid) {
          expect(node?.width).toBeCloseTo(27.4)
          expect(node?.height).toBeCloseTo(21.4)
        }
      } finally {
        editor.dispose()
      }
    }
  })

  test('graph replacement discards pending draw batches without replaying or deleting history', () => {
    const editor = createEditor()
    try {
      editor.createShape('RECTANGLE', 0, 0, 20, 20)
      const previousLabel = editor.undo.undoLabel
      const drag = start(editor)
      const graph = new SceneGraph()
      const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, { x: 10 })
      editor.replaceGraph(graph)
      expect(editor.undo.isBatching).toBe(false)
      expect(editor.undo.undoLabel).toBe(previousLabel)
      drag.commit()
      editor.updateNodeWithUndo(node.id, { x: 50 }, 'New graph move')
      expect(editor.undo.undoLabel).toBe('New graph move')
      editor.undoAction()
      expect(node.x).toBe(10)
      expect(editor.undo.undoLabel).toBe(previousLabel)
    } finally {
      editor.dispose()
    }
  })
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
