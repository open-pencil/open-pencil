import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { applyResize, commitResizePreview } from '#vue/shared/input/resize'
import type { DragResize } from '#vue/shared/input/types'

describe('section resize', () => {
  test('adopts the layers it grows over in the same undo step', () => {
    const editor = createEditor()
    try {
      const page = editor.state.currentPageId
      const section = editor.graph.createNode('SECTION', page, { width: 100, height: 100 })
      const box = editor.graph.createNode('RECTANGLE', page, {
        x: 150,
        y: 150,
        width: 40,
        height: 40
      })
      const drag: DragResize = {
        type: 'resize',
        handle: 'se',
        startX: 100,
        startY: 100,
        origRect: { x: 0, y: 0, width: 100, height: 100 },
        nodeId: section.id,
        origVectorNetwork: null,
        origFillGeometry: [],
        origStrokeGeometry: [],
        origDerivedTextGlyphs: null,
        origStrokes: [],
        origTextPathData: null,
        origTextPathBox: null,
        origChildren: null
      }

      applyResize(drag, 250, 250, false, editor)
      commitResizePreview(drag, editor)
      expect(editor.graph.getNode(box.id)?.parentId).toBe(section.id)

      editor.undoAction()
      expect(editor.graph.getNode(box.id)?.parentId).toBe(page)
      expect(editor.graph.getNode(section.id)?.width).toBe(100)
    } finally {
      editor.dispose()
    }
  })
})
