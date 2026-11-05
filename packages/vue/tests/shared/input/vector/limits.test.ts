import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'

import type { DragState } from '#vue/shared/input/types'
import { handleNodeEditDown, handleNodeEditMove } from '#vue/shared/input/vector'

let editor: Editor

afterEach(() => editor.dispose())

/**
 * A path (0,0) → (100,0) → (100,100) in edit mode at 100%, curved by one handle at (30,-40), with
 * nothing selected, while the host lets only handles change and shows every point's handles.
 */
function setup() {
  editor = createEditor()
  const path = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
    width: 100,
    height: 100,
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 30, y: -40 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    }
  })
  editor.setHostRestrictions({ pathEdits: 'handles' })
  editor.enterNodeEditMode(path.id, { handles: 'all' })
}

function press(cx: number, cy: number) {
  const started: { drag: DragState | null } = { drag: null }
  handleNodeEditDown({ shiftKey: false } as MouseEvent, cx, cy, editor, (d) => {
    started.drag = d
  })
  return started.drag
}

describe('editing a path whose points the host keeps', () => {
  test('a press on a point selects it, to show its handles, and drags nothing', () => {
    setup()
    expect(press(100, 0)).toBeNull()
    expect([...(editor.getNodeEditState()?.selectedVertexIndices ?? [])]).toEqual([1])
  })

  test('a press on a segment does not pick it up', () => {
    setup()
    expect(press(100, 50)?.type).toBe('edit-marquee')
    expect(editor.getNodeEditState()?.selectedSegmentIndices.size).toBe(0)
  })

  test("a press on a handle of a point that is not selected drags the handle", () => {
    setup()
    expect(press(30, -40)?.type).toBe('edit-handle')
  })

  test('a point drag already under way stops moving the point once the host keeps points', () => {
    setup()
    editor.setHostRestrictions({ pathEdits: 'all' })
    const drag = press(100, 0)
    if (drag?.type !== 'edit-node') throw new Error('Expected a point drag')
    editor.setHostRestrictions({ pathEdits: 'handles' })

    handleNodeEditMove(drag, 140, 30, editor, false, false, false, true)

    expect(editor.getNodeEditState()?.vertices[1]).toMatchObject({ x: 100, y: 0 })
  })
})
