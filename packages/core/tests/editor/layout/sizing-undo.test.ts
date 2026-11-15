import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { layoutSizingUpdates } from '@open-pencil/scene-graph/layout'

/** A 300-wide row, wrapping or not, with gap 16 around 100, 120 and 140 wide rectangles. */
function row(layoutWrap: 'WRAP' | 'NO_WRAP') {
  const editor = createEditor()
  const { graph } = editor
  const frame = graph.createNode('FRAME', editor.state.currentPageId, {
    width: 300,
    layoutMode: 'HORIZONTAL',
    layoutWrap,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    itemSpacing: 16
  })
  const items = [100, 120, 140].map((width) =>
    graph.createNode('RECTANGLE', frame.id, { width, height: 60 })
  )
  editor.runLayoutForNode(frame.id)
  return { editor, frame, items }
}

const boxes = (editor: ReturnType<typeof createEditor>, ids: string[]) =>
  ids.map((id) => {
    const node = editor.graph.getNode(id)
    return node ? [node.x, node.y, node.width, node.height] : null
  })

// Figma desktop 126: Edit › Undo after setting the middle item to Fill gives it back its 120 px,
// and Redo fills again, wrapping or not.
describe('undoing Fill', () => {
  for (const wrap of ['WRAP', 'NO_WRAP'] as const) {
    test(`puts back the size layout gave the layer (${wrap})`, () => {
      const { editor, frame, items } = row(wrap)
      const ids = [frame.id, ...items.map((item) => item.id)]
      const before = boxes(editor, ids)
      const middle = items[1]

      editor.updateNodeWithUndo(
        middle.id,
        layoutSizingUpdates(editor.graph, middle, 'HORIZONTAL', 'FILL'),
        'Set width sizing'
      )
      const filled = boxes(editor, ids)
      expect(filled).not.toEqual(before)

      editor.undoAction()
      expect(boxes(editor, ids)).toEqual(before)
      expect(editor.graph.getNode(middle.id)?.layoutGrow).toBe(0)

      editor.redoAction()
      expect(boxes(editor, ids)).toEqual(filled)
    })
  }
})
