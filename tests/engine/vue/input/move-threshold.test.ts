import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { handleMoveMove, handleMoveUp, MOVE_DRAG_START_THRESHOLD_PX } from '#vue/shared/input/move'
import { createSelectionMoveDrag } from '#vue/shared/input/select/move'
import type { DragMove } from '#vue/shared/input/types'

function setupMoveDrag(): {
  editor: ReturnType<typeof createEditor>
  drag: DragMove
  nodeId: string
} {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const node = editor.graph.createNode('RECTANGLE', pageId, {
    name: 'Box',
    x: 10,
    y: 20,
    width: 100,
    height: 80
  })
  editor.select([node.id])
  const drag = createSelectionMoveDrag(10, 20, 100, 200, editor, false)
  if (drag.type !== 'move') throw new Error('Expected move drag')
  return { editor, drag, nodeId: node.id }
}

describe('selection move drag threshold', () => {
  test('does not move selected nodes for click jitter below threshold', () => {
    const { editor, drag, nodeId } = setupMoveDrag()

    handleMoveMove(drag, 11, 21, 100 + MOVE_DRAG_START_THRESHOLD_PX - 1, 200, editor)
    handleMoveUp(drag, editor)

    const node = editor.graph.getNode(nodeId)
    expect(node?.x).toBe(10)
    expect(node?.y).toBe(20)
    expect(drag.dragStarted).toBe(false)
  })

  test('moves selected nodes once pointer movement exceeds threshold', () => {
    const { editor, drag, nodeId } = setupMoveDrag()

    handleMoveMove(drag, 16, 27, 100 + MOVE_DRAG_START_THRESHOLD_PX + 1, 200, editor)
    handleMoveUp(drag, editor)

    const node = editor.graph.getNode(nodeId)
    expect(node?.x).toBe(16)
    expect(node?.y).toBe(27)
    expect(drag.dragStarted).toBe(true)
  })

  test('removes duplicate created for alt-click without movement', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const node = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Box',
      x: 10,
      y: 20,
      width: 100,
      height: 80
    })
    editor.select([node.id])

    const drag = createSelectionMoveDrag(10, 20, 100, 200, editor, true)
    if (drag.type !== 'move') throw new Error('Expected move drag')
    expect(editor.graph.getChildren(pageId)).toHaveLength(2)

    handleMoveUp(drag, editor)

    expect(editor.graph.getChildren(pageId).map((child) => child.id)).toEqual([node.id])
    expect([...editor.state.selectedIds]).toEqual([node.id])
  })
})
