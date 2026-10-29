import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'

describe('moving a layer from the layers panel', () => {
  test('into a frame keeps it where it is drawn, and one undo puts it back', () => {
    const editor = createEditor()
    try {
      const page = editor.state.currentPageId
      const frame = editor.graph.createNode('FRAME', page, {
        x: 200,
        y: 100,
        width: 300,
        height: 300,
        rotation: 30
      })
      const layer = editor.graph.createNode('RECTANGLE', page, {
        x: 10,
        y: 20,
        width: 40,
        height: 40
      })
      const drawn = getAxisAlignedWorldBounds(layer, editor.graph)

      editor.reorderChildWithUndo(layer.id, frame.id, 0)
      const moved = editor.graph.getNode(layer.id)
      if (!moved) throw new Error('missing layer')
      expect(moved.parentId).toBe(frame.id)
      const after = getAxisAlignedWorldBounds(moved, editor.graph)
      expect(after.x).toBeCloseTo(drawn.x, 6)
      expect(after.y).toBeCloseTo(drawn.y, 6)

      editor.undo.undo()
      expect(editor.graph.getNode(layer.id)?.parentId).toBe(page)
      expect(editor.graph.getNode(layer.id)?.x).toBe(10)
      expect(editor.graph.getNode(layer.id)?.rotation).toBe(0)
    } finally {
      editor.dispose()
    }
  })

  test('is refused when it would make two components contain each other', () => {
    const editor = createEditor()
    try {
      const page = editor.state.currentPageId
      const a = editor.graph.createNode('COMPONENT', page, { width: 100, height: 100 })
      const b = editor.graph.createNode('COMPONENT', page, { x: 200, width: 100, height: 100 })
      editor.graph.createInstance(b.id, a.id)
      const instanceOfA = editor.graph.createInstance(a.id, page, { x: 400 })
      if (!instanceOfA) throw new Error('expected an instance')

      editor.reorderChildWithUndo(instanceOfA.id, b.id, 0)
      expect(editor.graph.getNode(instanceOfA.id)?.parentId).toBe(page)
    } finally {
      editor.dispose()
    }
  })
})
