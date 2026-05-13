import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

describe('editor scoped hit testing', () => {
  test('uses world coordinates inside entered containers', () => {
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
    editor.setCanvasKit({} as Parameters<typeof editor.setCanvasKit>[0], {} as Parameters<typeof editor.setCanvasKit>[1])

    expect(editor.hitTestAtPoint(130, 130)?.id).toBe(child.id)
  })
})
