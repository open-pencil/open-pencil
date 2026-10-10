import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import { applyResize, commitResizePreview } from '#vue/shared/input/resize'
import type { DragResize } from '#vue/shared/input/types'

function drag(node: SceneNode): DragResize {
  return {
    type: 'resize',
    handle: 'e',
    startX: node.width,
    startY: node.height / 2,
    origRect: { x: node.x, y: node.y, width: node.width, height: node.height },
    nodeId: node.id,
    origVectorNetwork: null,
    origFillGeometry: [],
    origStrokeGeometry: [],
    origDerivedTextGlyphs: null,
    origStrokes: [],
    origTextPathData: null,
    origTextPathBox: null,
    origChildren: null
  }
}

describe('resizing a frame read from a .fig file', () => {
  test('its Fill children fill the new size while dragging and after', () => {
    const editor = createEditor()
    try {
      const { graph } = editor
      const row = graph.createNode('FRAME', editor.state.currentPageId, {
        width: 200,
        height: 40,
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        paddingLeft: 10,
        paddingRight: 10
      })
      const field = graph.createNode('FRAME', row.id, {
        x: 10,
        width: 180,
        height: 40,
        layoutGrow: 1
      })
      for (const node of [row, field]) {
        graph.applyImportedStateDuring(() =>
          graph.updateNode(node.id, {
            source: { ...node.source, format: 'fig', id: node.id },
            derivedLayout: { x: node.x, y: node.y, width: node.width, height: node.height }
          })
        )
      }
      editor.runLayoutForNode(row.id)

      const resize = drag(row)
      applyResize(resize, 300, 20, false, editor, true)
      expect([row.width, field.width]).toEqual([300, 280])
      commitResizePreview(resize, editor)
      expect([row.width, field.width]).toEqual([300, 280])
      editor.undoAction()
      expect([row.width, field.width]).toEqual([200, 180])
    } finally {
      editor.dispose()
    }
  })
})
