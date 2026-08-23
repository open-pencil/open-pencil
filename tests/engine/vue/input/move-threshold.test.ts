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

  test('preserves fractional movement when pixel snapping is disabled', () => {
    const { editor, drag, nodeId } = setupMoveDrag()
    editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: false }

    handleMoveMove(drag, 16.25, 27.75, 110, 200, editor)
    handleMoveUp(drag, editor)

    expect(editor.graph.getNode(nodeId)).toMatchObject({ x: 16.25, y: 27.75 })
  })

  test('snaps movement to whole pixels when pixel snapping is enabled', () => {
    const { editor, drag, nodeId } = setupMoveDrag()
    editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: true }

    handleMoveMove(drag, 16.25, 27.75, 110, 200, editor)
    handleMoveUp(drag, editor)

    expect(editor.graph.getNode(nodeId)).toMatchObject({ x: 16, y: 28 })
  })

  test('Control bypasses object and pixel snapping during movement', () => {
    const { editor, drag, nodeId } = setupMoveDrag()

    handleMoveMove(drag, 16.25, 27.75, 110, 200, editor, true)
    handleMoveUp(drag, editor)

    expect(editor.graph.getNode(nodeId)).toMatchObject({ x: 16.25, y: 27.75 })
    expect(editor.state.snapGuides).toEqual([])
  })

  test('Control bypasses object and pixel snapping inside a rotated parent', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 200,
      y: 150,
      width: 300,
      height: 300,
      rotation: 30
    })
    const moving = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 20,
      y: 40,
      width: 50,
      height: 50
    })
    editor.select([moving.id])
    const drag = createSelectionMoveDrag(0, 0, 0, 0, editor, false)
    if (drag.type !== 'move') throw new Error('Expected move drag')

    handleMoveMove(drag, 74, 43, 100, 100, editor, true)

    const angle = (-30 * Math.PI) / 180
    expect(drag.appliedDx).toBeCloseTo(74 * Math.cos(angle) - 43 * Math.sin(angle), 3)
    expect(drag.appliedDy).toBeCloseTo(74 * Math.sin(angle) + 43 * Math.cos(angle), 3)
    expect(editor.state.snapGuides).toEqual([])
  })

  test('converts world movement into a rotated parent coordinate space', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 200,
      y: 150,
      width: 300,
      height: 300,
      rotation: 30
    })
    const moving = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 20,
      y: 40,
      width: 50,
      height: 50
    })
    editor.select([moving.id])
    editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: false }
    const drag = createSelectionMoveDrag(0, 0, 0, 0, editor, false)
    if (drag.type !== 'move') throw new Error('Expected move drag')

    handleMoveMove(drag, 74, 43, 100, 100, editor)

    expect(editor.state.snapGuides).toEqual([])
    const angle = (-30 * Math.PI) / 180
    expect(drag.appliedDx).toBeCloseTo(74 * Math.cos(angle) - 43 * Math.sin(angle), 3)
    expect(drag.appliedDy).toBeCloseTo(74 * Math.sin(angle) + 43 * Math.cos(angle), 3)
  })

  test('stores rounded preview displacement when targeting auto-layout', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const moving = editor.graph.createNode('RECTANGLE', pageId, {
      x: 10.25,
      y: 20.25,
      width: 20,
      height: 20
    })
    editor.graph.createNode('FRAME', pageId, {
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      layoutMode: 'HORIZONTAL'
    })
    editor.select([moving.id])
    const drag = createSelectionMoveDrag(10.25, 20.25, 0, 0, editor, false)
    if (drag.type !== 'move') throw new Error('Expected move drag')

    handleMoveMove(drag, 150.6, 130.7, 10, 10, editor)

    expect(drag.appliedDx).toBeCloseTo(140.75)
    expect(drag.appliedDy).toBeCloseTo(110.75)
    expect(editor.graph.getNode(moving.id)).toMatchObject({ x: 151, y: 131 })
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
