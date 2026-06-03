import { describe, expect, test } from 'bun:test'
import { ref } from 'vue'

import { createEditor } from '@inkly/core/editor'
import { computeAllLayouts } from '@inkly/core/layout'

import {
  cancelMoveDragInterruption,
  clearDraggingClipBypassFrame
} from '#vue/canvas/useCanvasInput'
import { handleMoveMove, handleMoveUp } from '#vue/shared/input/move'
import { createSelectionMoveDrag } from '#vue/shared/input/select/move'

function setupAutoLayoutDrag() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const parent = editor.graph.createNode('FRAME', pageId, {
    name: 'AutoFrame',
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 10,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10
  })
  const child1 = editor.graph.createNode('RECTANGLE', parent.id, {
    name: 'Child1',
    x: 10,
    y: 10,
    width: 100,
    height: 100
  })
  const child2 = editor.graph.createNode('RECTANGLE', parent.id, {
    name: 'Child2',
    x: 120,
    y: 10,
    width: 100,
    height: 100
  })

  computeAllLayouts(editor.graph, parent.id)
  editor.select([child1.id])

  const drag = createSelectionMoveDrag(60, 60, 60, 60, editor, false)
  if (drag.type !== 'move') throw new Error('Expected move drag')

  return { editor, drag, parentId: parent.id, child1Id: child1.id, child2Id: child2.id }
}

function setupNonAutoLayoutChildDrag() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const parent = editor.graph.createNode('FRAME', pageId, {
    name: 'RegularFrame',
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    layoutMode: 'NONE'
  })
  const child = editor.graph.createNode('RECTANGLE', parent.id, {
    name: 'Child',
    x: 10,
    y: 10,
    width: 100,
    height: 100
  })

  editor.select([child.id])

  const drag = createSelectionMoveDrag(60, 60, 60, 60, editor, false)
  if (drag.type !== 'move') throw new Error('Expected move drag')

  return { editor, drag, childId: child.id }
}

describe('Cmd/Ctrl auto-layout bypass', () => {
  test('AC1: bypass keeps insert indicator cleared and allows free movement inside the parent bounds', () => {
    const { editor, drag, parentId, child1Id } = setupAutoLayoutDrag()

    handleMoveMove(drag, 150, 60, 150, 60, editor, true)

    expect(editor.state.layoutInsertIndicator).toBeNull()
    expect(editor.state.draggingClipBypassFrameId).toBe(parentId)
    expect(editor.graph.getNode(child1Id)?.x).not.toBe(10)
  })

  test('AC2: bypass mouseup pins the node as ABSOLUTE and undo restores position and layoutPositioning together', () => {
    const { editor, drag, child1Id } = setupAutoLayoutDrag()

    handleMoveMove(drag, 200, 80, 200, 80, editor, true)
    handleMoveUp(drag, editor, true)

    expect(editor.graph.getNode(child1Id)?.layoutPositioning).toBe('ABSOLUTE')

    editor.undoAction()

    const restored = editor.graph.getNode(child1Id)
    expect(restored?.layoutPositioning).not.toBe('ABSOLUTE')
    expect(restored?.x).toBe(10)
  })

  test('AC3: releasing Cmd/Ctrl before mouseup returns to normal auto-layout completion', () => {
    const { editor, drag, child1Id, parentId } = setupAutoLayoutDrag()

    handleMoveMove(drag, 150, 60, 150, 60, editor, true)
    expect(editor.state.draggingClipBypassFrameId).toBe(parentId)
    handleMoveMove(drag, 200, 80, 200, 80, editor, false)
    expect(editor.state.draggingClipBypassFrameId).toBeNull()
    handleMoveUp(drag, editor, false)

    expect(editor.graph.getNode(child1Id)?.layoutPositioning).not.toBe('ABSOLUTE')
  })

  test('AC5: mouseup always clears draggingClipBypassFrameId', () => {
    const { editor, drag, parentId } = setupAutoLayoutDrag()

    handleMoveMove(drag, 200, 80, 200, 80, editor, true)
    expect(editor.state.draggingClipBypassFrameId).toBe(parentId)

    handleMoveUp(drag, editor, true)

    expect(editor.state.draggingClipBypassFrameId).toBeNull()
  })

  test('AC4: an already absolute child stays on the normal free-move path', () => {
    const { editor, child1Id } = setupAutoLayoutDrag()

    editor.updateNode(child1Id, { layoutPositioning: 'ABSOLUTE' })
    editor.select([child1Id])

    const drag = createSelectionMoveDrag(60, 60, 60, 60, editor, false)
    if (drag.type !== 'move') throw new Error('Expected move drag')

    expect(drag.autoLayoutParentId).toBeUndefined()

    handleMoveMove(drag, 200, 80, 200, 80, editor, true)
    handleMoveUp(drag, editor, true)

    expect(editor.graph.getNode(child1Id)?.layoutPositioning).toBe('ABSOLUTE')
  })

  test('AC5: multi-select drag ignores bypass and does not pin children', () => {
    const { editor, child1Id, child2Id } = setupAutoLayoutDrag()

    editor.select([child1Id, child2Id])

    const drag = createSelectionMoveDrag(60, 60, 60, 60, editor, false)
    if (drag.type !== 'move') throw new Error('Expected move drag')

    expect(drag.autoLayoutParentId).toBeUndefined()

    handleMoveMove(drag, 200, 80, 200, 80, editor, true)
    handleMoveUp(drag, editor, true)

    expect(editor.graph.getNode(child1Id)?.layoutPositioning).not.toBe('ABSOLUTE')
    expect(editor.graph.getNode(child2Id)?.layoutPositioning).not.toBe('ABSOLUTE')
  })

  test('does not pin a child inside a layoutMode=NONE parent even when mouseup requests absolute pinning', () => {
    const { editor, drag, childId } = setupNonAutoLayoutChildDrag()

    expect(drag.autoLayoutParentId).toBeUndefined()

    handleMoveMove(drag, 160, 90, 160, 90, editor, true)
    handleMoveUp(drag, editor, true)

    const child = editor.graph.getNode(childId)
    expect(child?.layoutPositioning).not.toBe('ABSOLUTE')
    expect(child?.x).toBe(110)
    expect(child?.y).toBe(40)
  })

  test('does not pin multi-select drags moved outside the auto-layout frame', () => {
    const { editor, child1Id, child2Id } = setupAutoLayoutDrag()

    editor.select([child1Id, child2Id])

    const drag = createSelectionMoveDrag(60, 60, 60, 60, editor, false)
    if (drag.type !== 'move') throw new Error('Expected move drag')

    expect(drag.autoLayoutParentId).toBeUndefined()

    handleMoveMove(drag, 520, 80, 520, 80, editor, true)
    handleMoveUp(drag, editor, true)

    expect(editor.graph.getNode(child1Id)?.layoutPositioning).not.toBe('ABSOLUTE')
    expect(editor.graph.getNode(child2Id)?.layoutPositioning).not.toBe('ABSOLUTE')
  })

  test('mouseup pinning decision follows the final argument even when drag move never bypassed auto-layout', () => {
    const { editor, drag, child1Id } = setupAutoLayoutDrag()

    expect(drag.autoLayoutParentId).toBeDefined()

    handleMoveMove(drag, 520, 80, 520, 80, editor, false)
    handleMoveUp(drag, editor, true)

    expect(editor.graph.getNode(child1Id)?.layoutPositioning).toBe('ABSOLUTE')
  })

  test('R2-001: late Cmd press wins over stale indicator without another mousemove', () => {
    const { editor, drag, child1Id } = setupAutoLayoutDrag()

    handleMoveMove(drag, 220, 60, 220, 60, editor, false)

    expect(editor.state.layoutInsertIndicator).not.toBeNull()

    handleMoveUp(drag, editor, true)

    expect(editor.graph.getNode(child1Id)?.layoutPositioning).toBe('ABSOLUTE')
  })

  test('clears clip bypass state through the shared cleanup path when a drag is interrupted', () => {
    const { editor, drag, parentId } = setupAutoLayoutDrag()

    handleMoveMove(drag, 200, 80, 200, 80, editor, true)

    expect(editor.state.draggingClipBypassFrameId).toBe(parentId)

    clearDraggingClipBypassFrame(editor)

    expect(editor.state.draggingClipBypassFrameId).toBeNull()
  })

  test('R2-001: cleanup paths cancel move drags and restore preview before bypass can re-arm', () => {
    const { editor, drag, parentId, child1Id } = setupAutoLayoutDrag()
    const dragState = ref(drag)

    handleMoveMove(drag, 150, 60, 150, 60, editor, true)

    expect(editor.state.draggingClipBypassFrameId).toBe(parentId)
    expect(editor.graph.getNode(child1Id)?.x).not.toBe(10)

    cancelMoveDragInterruption(editor, dragState)

    expect(dragState.value).toBeNull()
    expect(editor.state.draggingClipBypassFrameId).toBeNull()
    expect(editor.graph.getNode(child1Id)?.x).toBe(10)

    if (dragState.value?.type === 'move') {
      handleMoveMove(dragState.value, 200, 80, 200, 80, editor, true)
    }

    expect(editor.state.draggingClipBypassFrameId).toBeNull()
    expect(editor.graph.getNode(child1Id)?.x).toBe(10)
  })
})
