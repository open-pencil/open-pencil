import { describe, expect, test } from 'bun:test'

import { DEFAULT_FRAME_FILL } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'

describe('frameSelection', () => {
  test('wraps selected nodes in a frame and preserves visual positions', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'First',
      x: 20,
      y: 30,
      width: 40,
      height: 50
    })
    const second = editor.graph.createNode('ELLIPSE', pageId, {
      name: 'Second',
      x: 100,
      y: 120,
      width: 30,
      height: 20
    })

    editor.select([first.id, second.id])
    const beforeFirst = editor.graph.getAbsolutePosition(first.id)
    const beforeSecond = editor.graph.getAbsolutePosition(second.id)

    editor.frameSelection()

    const [frameId] = [...editor.state.selectedIds]
    const frame = frameId ? editor.graph.getNode(frameId) : null
    expect(frame?.type).toBe('FRAME')
    expect(frame?.x).toBe(20)
    expect(frame?.y).toBe(30)
    expect(frame?.width).toBe(110)
    expect(frame?.height).toBe(110)
    expect(frame?.fills).toEqual([DEFAULT_FRAME_FILL])
    expect(first.parentId).toBe(frameId)
    expect(second.parentId).toBe(frameId)
    expect(editor.graph.getAbsolutePosition(first.id)).toEqual(beforeFirst)
    expect(editor.graph.getAbsolutePosition(second.id)).toEqual(beforeSecond)
  })

  test('undo and redo restore frame selection state', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, {
      x: 20,
      y: 30,
      width: 40,
      height: 50
    })
    const second = editor.graph.createNode('ELLIPSE', pageId, {
      x: 100,
      y: 120,
      width: 30,
      height: 20
    })

    editor.select([first.id, second.id])
    editor.frameSelection()
    const [frameId] = [...editor.state.selectedIds]

    editor.undo.undo()

    expect(editor.graph.getNode(first.id)?.parentId).toBe(pageId)
    expect(editor.graph.getNode(second.id)?.parentId).toBe(pageId)
    expect(editor.state.selectedIds).toEqual(new Set([first.id, second.id]))

    editor.undo.redo()

    const frame = editor.graph.getNode(frameId)
    expect(frame?.type).toBe('FRAME')
    expect(frame?.fills).toEqual([DEFAULT_FRAME_FILL])
    expect(editor.graph.getNode(first.id)?.parentId).toBe(frameId)
    expect(editor.graph.getNode(second.id)?.parentId).toBe(frameId)
    expect(editor.state.selectedIds).toEqual(new Set([frameId]))
  })
})
