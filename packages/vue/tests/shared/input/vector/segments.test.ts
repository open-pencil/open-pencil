import { afterEach, describe, expect, mock, test } from 'bun:test'

import { ref } from 'vue'

import { createEditor, type Editor } from '@open-pencil/core'

import { handleNodeEditPointerUp } from '#vue/canvas/vector-input/input'
import type { DragState } from '#vue/shared/input/types'
import {
  finishNodeEditMarquee,
  getNodeEditState,
  handleNodeEditDown,
  handleNodeEditMarqueeMove,
  handleNodeEditMove
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
    selectedSegmentIndices: new Set<number>(),
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

function selectedSegments() {
  return [...(getNodeEditState(editor)?.selectedSegmentIndices ?? [])].sort()
}

describe('editing a path: segments', () => {
  test('a press on a segment selects the segment, not its points, and drags its points', () => {
    setup()
    const es = getNodeEditState(editor)
    if (es) es.selectedVertexIndices = new Set([2])
    const drag = press(50, 2)
    expect(selectedSegments()).toEqual([0])
    expect(selected()).toEqual([])
    expect(drag?.type).toBe('edit-node')
    if (drag?.type !== 'edit-node') return
    expect([...drag.origPositions.keys()].sort()).toEqual([0, 1])
    expect(exitNodeEditMode).not.toHaveBeenCalled()
  })

  test('Shift adds a segment to the selection', () => {
    setup()
    press(50, 0)
    press(100, 50, true)
    expect(selectedSegments()).toEqual([0, 1])
  })

  test('a press on a selected segment drags the whole selection', () => {
    setup()
    press(50, 0)
    press(100, 50, true)
    const drag = press(50, 0)
    expect(selectedSegments()).toEqual([0, 1])
    if (drag?.type !== 'edit-node') throw new Error('expected a point drag')
    expect([...drag.origPositions.keys()].sort()).toEqual([0, 1, 2])
  })
})

describe('editing a path: marquee', () => {
  test('a drag over empty space selects the points it encloses', () => {
    setup()
    const drag = press(80, -20)
    if (drag?.type !== 'edit-marquee') throw new Error('expected a marquee')
    handleNodeEditMarqueeMove(drag, 120, 120, editor)
    expect(selected()).toEqual([1, 2])
    expect(selectedSegments()).toEqual([1])
    finishNodeEditMarquee(editor)
    expect(editor.state.marquee).toBeNull()
    expect(exitNodeEditMode).not.toHaveBeenCalled()
  })

  test('with Shift it keeps what was already selected', () => {
    setup()
    const es = getNodeEditState(editor)
    if (es) {
      es.selectedVertexIndices = new Set([0])
      es.selectedSegmentIndices = new Set([0])
    }
    const drag = press(80, 80, true)
    if (drag?.type !== 'edit-marquee') throw new Error('expected a marquee')
    handleNodeEditMarqueeMove(drag, 120, 120, editor)
    expect(selected()).toEqual([0, 2])
    expect(selectedSegments()).toEqual([0])
  })

  test('without Shift it replaces the selection', () => {
    setup()
    const es = getNodeEditState(editor)
    if (es) es.selectedSegmentIndices = new Set([0])
    const drag = press(80, 80)
    if (drag?.type !== 'edit-marquee') throw new Error('expected a marquee')
    handleNodeEditMarqueeMove(drag, 120, 120, editor)
    expect(selected()).toEqual([2])
    expect(selectedSegments()).toEqual([])
  })

  test('a click on empty space still leaves edit mode', () => {
    setup()
    const drag = press(50, 60)
    if (drag?.type !== 'edit-marquee') throw new Error('expected a marquee')
    finishNodeEditMarquee(editor)
    expect(exitNodeEditMode).toHaveBeenCalledWith(true)
  })
})

describe('editing a path: regions and segments', () => {
  /** The same path closed back to (0,0), filled as one region. */
  function setupFilled() {
    setup()
    const es = getNodeEditState(editor)
    if (!es) throw new Error('expected edit state')
    es.segments = [...es.segments, { start: 2, end: 0, tangentStart: zero, tangentEnd: zero }]
    es.regions = [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
    es.selectedRegions = new Set()
    return es
  }

  test('picking a region replaces selected segments with the region and its points', () => {
    const es = setupFilled()
    press(50, 0)
    expect(selectedSegments()).toEqual([0])
    press(70, 30)
    expect([...(es.selectedRegions ?? [])]).toEqual([0])
    expect(selected()).toEqual([0, 1, 2])
    expect(selectedSegments()).toEqual([])
  })

  test('a press on a segment drops the picked region', () => {
    const es = setupFilled()
    press(70, 30)
    press(100, 50)
    expect([...(es.selectedRegions ?? [])]).toEqual([])
    expect(selectedSegments()).toEqual([1])
  })
})

// Figma desktop 126, a 260 × 200 shape of two rooms sharing the wall x = 130: a press on a picked
// room keeps both picked so a drag moves them together; a click narrows to that room and a
// Shift-click drops it.
describe('editing a path: pressing a picked region', () => {
  function setupRooms() {
    setup()
    const es = getNodeEditState(editor)
    if (!es) throw new Error('expected edit state')
    const line = (start: number, end: number) => ({
      start,
      end,
      tangentStart: zero,
      tangentEnd: zero
    })
    es.vertices = [
      { x: 0, y: 0 },
      { x: 130, y: 0 },
      { x: 260, y: 0 },
      { x: 260, y: 200 },
      { x: 130, y: 200 },
      { x: 0, y: 200 }
    ]
    es.segments = [
      line(0, 1),
      line(1, 4),
      line(4, 5),
      line(5, 0),
      line(1, 2),
      line(2, 3),
      line(3, 4)
    ]
    es.regions = [
      { windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] },
      { windingRule: 'NONZERO', loops: [[4, 5, 6, 1]] }
    ]
    es.selectedRegions = new Set()
    press(65, 100)
    press(195, 100, true)
    return es
  }

  function release(drag: DragState | null) {
    handleNodeEditPointerUp(ref(drag), editor)
  }

  test('a drag from one moves both and keeps both picked', () => {
    const es = setupRooms()
    const drag = press(65, 100)
    if (drag?.type !== 'edit-node') throw new Error('expected a point drag')
    handleNodeEditMove(drag, 65, 140, editor, false, false, false, true)
    release(drag)
    expect([...(es.selectedRegions ?? [])].sort()).toEqual([0, 1])
    expect(es.vertices.map((vertex) => vertex.y)).toEqual([40, 40, 40, 240, 240, 240])
  })

  test('a click narrows to the room clicked', () => {
    const es = setupRooms()
    release(press(65, 100))
    expect([...(es.selectedRegions ?? [])]).toEqual([0])
    expect(selected()).toEqual([0, 1, 4, 5])
  })

  test('a Shift-click drops the room and the points only it had', () => {
    const es = setupRooms()
    release(press(195, 100, true))
    expect([...(es.selectedRegions ?? [])]).toEqual([0])
    expect(selected()).toEqual([0, 1, 4, 5])
  })
})

describe('editing a path: pressing a selected segment', () => {
  function release(drag: DragState | null) {
    handleNodeEditPointerUp(ref(drag), editor)
  }

  test('releasing without a drag selects only that segment, as in Figma', () => {
    setup()
    press(50, 0)
    press(100, 50, true)
    const drag = press(50, 0)
    // The press keeps both, so a drag would move them together.
    expect(selectedSegments()).toEqual([0, 1])
    release(drag)
    expect(selectedSegments()).toEqual([0])
    expect(selected()).toEqual([])
  })

  test('a Shift-click takes it out of the selection on release', () => {
    setup()
    press(50, 0)
    press(100, 50, true)
    const drag = press(50, 0, true)
    expect(selectedSegments()).toEqual([0, 1])
    release(drag)
    expect(selectedSegments()).toEqual([1])
  })

  // Figma desktop 126: a Shift-drag from a selected segment moves it with the rest of the
  // selection and leaves it selected.
  test('a Shift-drag moves the whole selection and keeps it', () => {
    setup()
    press(50, 0)
    press(100, 50, true)
    const drag = press(50, 0, true)
    if (drag?.type !== 'edit-node') throw new Error('expected a point drag')
    handleNodeEditMove(drag, 50, -20, editor, false, false, false, true)
    release(drag)
    expect(selectedSegments()).toEqual([0, 1])
    expect(getNodeEditState(editor)?.vertices.map((vertex) => vertex.y)).toEqual([-20, -20, 80])
  })

  test('a drag moves the whole selection and keeps it', () => {
    setup()
    press(50, 0)
    press(100, 50, true)
    const drag = press(50, 0)
    if (drag?.type !== 'edit-node') throw new Error('expected a point drag')
    handleNodeEditMove(drag, 50, -20, editor, false, false, false, true)
    release(drag)
    expect(selectedSegments()).toEqual([0, 1])
    expect(getNodeEditState(editor)?.vertices.map((vertex) => vertex.y)).toEqual([-20, -20, 80])
  })
})
