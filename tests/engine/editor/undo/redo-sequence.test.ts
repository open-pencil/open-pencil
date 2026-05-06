import { describe, test, expect } from 'bun:test'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import { createHistoryFrame, setupEditorPage } from '#tests/helpers/editor-history'

describe('undo/redo multi-step sequences', () => {
  test('create → move → duplicate → move copy → undo all → redo all', () => {
    const { editor, pageId } = setupEditorPage()

    const frame = createHistoryFrame(editor, pageId, { x: 100, y: 100 })
    editor.select([frame.id])
    const createSnapshot = structuredClone(getNodeOrThrow(editor.graph, frame.id))
    editor.pushUndoEntry({
      label: 'Create',
      forward: () => {
        const { parentId: _p, childIds: _c, ...rest } = createSnapshot
        editor.graph.createNode('FRAME', pageId, rest)
      },
      inverse: () => editor.graph.deleteNode(frame.id)
    })

    editor.graph.updateNode(frame.id, { x: 300, y: 50 })
    editor.commitMove(new Map([[frame.id, { x: 100, y: 100 }]]))

    expect(getNodeOrThrow(editor.graph, frame.id).x).toBe(300)
    expect(getNodeOrThrow(editor.graph, frame.id).y).toBe(50)

    editor.duplicateSelected()
    const dupIds = [...editor.state.selectedIds]
    expect(dupIds).toHaveLength(1)
    const dupId = expectDefined(dupIds[0], 'duplicate id')
    expect(dupId).not.toBe(frame.id)

    editor.graph.updateNode(dupId, { x: 500, y: 200 })
    editor.commitMove(new Map([[dupId, { x: 320, y: 70 }]]))

    // Undo move copy
    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, dupId).x).toBe(320)

    // Undo duplicate
    editor.undo.undo()
    expect(editor.graph.getNode(dupId)).toBeUndefined()

    // Undo move
    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, frame.id).x).toBe(100)

    // Undo create
    editor.undo.undo()
    expect(editor.graph.getNode(frame.id)).toBeUndefined()

    // Redo create
    editor.undo.redo()
    expect(editor.graph.getNode(frame.id)).not.toBeUndefined()
    expect(getNodeOrThrow(editor.graph, frame.id).x).toBe(100)

    // Redo move
    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, frame.id).x).toBe(300)

    // Redo duplicate — must recreate with SAME ID
    editor.undo.redo()
    expect(editor.graph.getNode(dupId)).not.toBeUndefined()

    // Redo move copy — must find the node by same ID
    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, dupId).x).toBe(500)
    expect(getNodeOrThrow(editor.graph, dupId).y).toBe(200)
  })

  test('duplicate with children preserves subtree on redo', () => {
    const { editor, pageId } = setupEditorPage()

    const frame = createHistoryFrame(editor, pageId, { x: 50, y: 50 })
    editor.graph.createNode('TEXT', frame.id, {
      name: 'Title',
      text: 'Hello',
      x: 10,
      y: 10,
      width: 100,
      height: 20
    })

    editor.select([frame.id])
    editor.duplicateSelected()

    const dupFrameId = expectDefined([...editor.state.selectedIds][0], 'duplicated frame id')
    const dupChildren = getNodeOrThrow(editor.graph, dupFrameId).childIds
    expect(dupChildren).toHaveLength(1)
    const dupTextId = expectDefined(dupChildren[0], 'duplicated text id')
    expect(getNodeOrThrow(editor.graph, dupTextId).text).toBe('Hello')

    // Undo
    editor.undo.undo()
    expect(editor.graph.getNode(dupFrameId)).toBeUndefined()
    expect(editor.graph.getNode(dupTextId)).toBeUndefined()

    // Redo — must recreate with same IDs
    editor.undo.redo()
    expect(editor.graph.getNode(dupFrameId)).not.toBeUndefined()
    expect(editor.graph.getNode(dupTextId)).not.toBeUndefined()
    expect(getNodeOrThrow(editor.graph, dupFrameId).childIds).toContain(dupTextId)
    expect(getNodeOrThrow(editor.graph, dupTextId).text).toBe('Hello')
  })

  test('page snapshot restore preserves node IDs', () => {
    const { editor, pageId } = setupEditorPage()
    const frame = createHistoryFrame(editor, pageId)
    const child = editor.graph.createNode('RECTANGLE', frame.id, {
      name: 'Bg',
      width: 200,
      height: 150
    })

    const snapshot = editor.snapshotPage()
    editor.graph.deleteNode(frame.id)
    editor.restorePageFromSnapshot(snapshot)

    expect(editor.graph.getNode(frame.id)).not.toBeUndefined()
    expect(editor.graph.getNode(child.id)).not.toBeUndefined()
    expect(getNodeOrThrow(editor.graph, frame.id).childIds).toEqual([child.id])
  })

  test('delete frame with children → undo restores subtree', () => {
    const { editor, pageId } = setupEditorPage()

    const frame = createHistoryFrame(editor, pageId)
    const child = editor.graph.createNode('RECTANGLE', frame.id, {
      name: 'Bg',
      x: 0,
      y: 0,
      width: 200,
      height: 150
    })

    editor.select([frame.id])
    editor.deleteSelected()

    expect(editor.graph.getNode(frame.id)).toBeUndefined()
    expect(editor.graph.getNode(child.id)).toBeUndefined()

    editor.undo.undo()
    expect(editor.graph.getNode(frame.id)).not.toBeUndefined()
    expect(editor.graph.getNode(child.id)).not.toBeUndefined()
    expect(getNodeOrThrow(editor.graph, frame.id).childIds).toContain(child.id)
  })
})
