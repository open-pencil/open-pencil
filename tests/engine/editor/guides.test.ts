import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const frame = editor.graph.createNode('FRAME', pageId, {
    x: 100,
    y: 100,
    width: 300,
    height: 200
  })
  return { editor, pageId, frameId: frame.id }
}

describe('guide editor actions', () => {
  test('adds, moves, removes, and undoes a page guide', () => {
    const { editor, pageId } = setup()
    const id = editor.addGuide(pageId, 'x', 42)
    expect(id).not.toBeNull()
    expect(editor.graph.getNode(pageId)?.guides).toEqual([{ id, axis: 'x', position: 42 }])

    expect(editor.moveGuide(pageId, id ?? '', 84)).toBe(true)
    expect(editor.graph.getNode(pageId)?.guides[0]?.position).toBe(84)
    editor.undoAction()
    expect(editor.graph.getNode(pageId)?.guides[0]?.position).toBe(42)

    expect(editor.removeGuide(pageId, id ?? '')).toBe(true)
    expect(editor.graph.getNode(pageId)?.guides).toEqual([])
    editor.undoAction()
    expect(editor.graph.getNode(pageId)?.guides[0]?.position).toBe(42)
  })

  test('transfers a guide between page and frame in one undo step', () => {
    const { editor, pageId, frameId } = setup()
    const id = editor.addGuide(pageId, 'y', 120)
    editor.undo.clear()

    expect(editor.transferGuide(pageId, frameId, id ?? '', 20)).toBe(true)
    expect(editor.graph.getNode(pageId)?.guides).toEqual([])
    expect(editor.graph.getNode(frameId)?.guides).toEqual([{ id, axis: 'y', position: 20 }])

    editor.undoAction()
    expect(editor.graph.getNode(pageId)?.guides).toEqual([{ id, axis: 'y', position: 120 }])
    expect(editor.graph.getNode(frameId)?.guides).toEqual([])
  })

  test('rejects unsupported owners and no-op movement', () => {
    const { editor, pageId } = setup()
    const rect = editor.graph.createNode('RECTANGLE', pageId)
    expect(editor.addGuide(rect.id, 'x', 10)).toBeNull()
    const id = editor.addGuide(pageId, 'x', 10)
    expect(editor.moveGuide(pageId, id ?? '', 10)).toBe(false)
  })
})
