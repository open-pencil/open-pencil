import { afterEach, describe, expect, mock, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'

import type { DragState } from '#vue/shared/input/types'
import {
  finishNodeEditMarquee,
  getNodeEditState,
  handleNodeEditDown,
  handleNodeEditMarqueeMove
} from '#vue/shared/input/vector'

let editor: Editor
let exitNodeEditMode: ReturnType<typeof mock>

afterEach(() => editor.dispose())

const zero = { x: 0, y: 0 }

/** An open path (0,0) → (100,0) → (100,100) in edit mode, with nothing selected. */
function setup() {
  editor = createEditor()
  exitNodeEditMode = mock()
  Object.assign(editor, { exitNodeEditMode, nodeEditPushHistory: mock() })
  editor.state.nodeEditState = {
    nodeId: 'path',
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 }
    ],
    segments: [
      { start: 0, end: 1, tangentStart: zero, tangentEnd: zero },
      { start: 1, end: 2, tangentStart: zero, tangentEnd: zero }
    ],
    regions: [],
    selectedVertexIndices: new Set<number>(),
    selectedHandles: new Set<number>(),
    hoveredHandleInfo: null
  }
}

function press(cx: number, cy: number, shiftKey = false) {
  const started: { drag: DragState | null } = { drag: null }
  handleNodeEditDown({ shiftKey } as MouseEvent, cx, cy, editor, (d) => {
    started.drag = d
  })
  return started.drag
}

function selected() {
  return [...(getNodeEditState(editor)?.selectedVertexIndices ?? [])].sort()
}

describe('editing a path: segments', () => {
  test('a press on a segment selects its two points and drags them, staying in edit mode', () => {
    setup()
    const drag = press(50, 2)
    expect(selected()).toEqual([0, 1])
    expect(drag?.type).toBe('edit-node')
    if (drag?.type !== 'edit-node') return
    expect([...drag.origPositions.keys()].sort()).toEqual([0, 1])
    expect(exitNodeEditMode).not.toHaveBeenCalled()
  })

  test('Shift adds a segment’s points to the selection', () => {
    setup()
    press(50, 0)
    press(100, 50, true)
    expect(selected()).toEqual([0, 1, 2])
  })
})

describe('editing a path: marquee', () => {
  test('a drag over empty space selects the points it encloses', () => {
    setup()
    const drag = press(80, -20)
    if (drag?.type !== 'edit-marquee') throw new Error('expected a marquee')
    handleNodeEditMarqueeMove(drag, 120, 120, editor)
    expect(selected()).toEqual([1, 2])
    finishNodeEditMarquee(editor)
    expect(editor.state.marquee).toBeNull()
    expect(exitNodeEditMode).not.toHaveBeenCalled()
  })

  test('with Shift it keeps the points already selected', () => {
    setup()
    const es = getNodeEditState(editor)
    if (es) es.selectedVertexIndices = new Set([0])
    const drag = press(80, 80, true)
    if (drag?.type !== 'edit-marquee') throw new Error('expected a marquee')
    handleNodeEditMarqueeMove(drag, 120, 120, editor)
    expect(selected()).toEqual([0, 2])
  })

  test('a click on empty space still leaves edit mode', () => {
    setup()
    const drag = press(50, 60)
    if (drag?.type !== 'edit-marquee') throw new Error('expected a marquee')
    finishNodeEditMarquee(editor)
    expect(exitNodeEditMode).toHaveBeenCalledWith(true)
  })
})
