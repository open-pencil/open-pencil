import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

describe('editor hit testing', () => {
  test('finds layers from the page whatever container is entered', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 100,
      y: 100,
      width: 200,
      height: 200
    })
    const child = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    editor.state.enteredContainerId = frame.id
    editor.setCanvasKit(
      {} as Parameters<typeof editor.setCanvasKit>[0],
      {} as Parameters<typeof editor.setCanvasKit>[1]
    )

    expect(editor.hitTestAtPoint(130, 130)?.id).toBe(child.id)
  })

  test("selectAtPoint on a board selects the frame over its child", () => {
    const editor = createEditor()
    editor.setDocumentKind('board')
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, { x: 100, y: 100, width: 200, height: 200 })
    editor.graph.createNode('RECTANGLE', frame.id, {
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    editor.setCanvasKit(
      {} as Parameters<typeof editor.setCanvasKit>[0],
      {} as Parameters<typeof editor.setCanvasKit>[1]
    )

    editor.selectAtPoint(130, 130)
    expect([...editor.state.selectedIds]).toEqual([frame.id])
  })

  test("selectAtPoint inside an entered board frame selects its child", () => {
    const editor = createEditor()
    editor.setDocumentKind('board')
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, { x: 100, y: 100, width: 200, height: 200 })
    const child = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 20,
      y: 20,
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    editor.setCanvasKit(
      {} as Parameters<typeof editor.setCanvasKit>[0],
      {} as Parameters<typeof editor.setCanvasKit>[1]
    )

    editor.state.enteredContainerId = frame.id
    editor.selectAtPoint(130, 130)
    expect([...editor.state.selectedIds]).toEqual([child.id])
    // The entered container follows the selection, as after a press.
    expect(editor.state.enteredContainerId).toBe(frame.id)
    editor.selectAtPoint(500, 500)
    expect([...editor.state.selectedIds]).toEqual([])
  })
})
