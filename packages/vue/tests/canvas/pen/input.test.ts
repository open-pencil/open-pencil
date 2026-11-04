import { afterEach, describe, expect, mock, test } from 'bun:test'

import { ref } from 'vue'

import { createEditor, type Editor } from '@open-pencil/core'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { startPenInput, updatePenHover } from '#vue/canvas/pen/input'
import { resolveVertexSnap } from '#vue/shared/input/snap'

let editor: Editor

afterEach(() => editor.dispose())

function setup() {
  editor = createEditor()
  editor.setTool('PEN')
  return editor
}

function click(x: number, y: number) {
  startPenInput({ altKey: false }, x, y, editor, mock(), ref<string | null>(null))
}

// Figma desktop 126 at 100%: the pen's next point lines up with the path's own vertices from 4
// screen pixels away, not 5, and ignores other layers.
describe('pen vertex snapping', () => {
  const vertices: Vector[] = [
    { x: 0, y: 120 },
    { x: 100, y: 0 },
    { x: 200, y: 120 }
  ]

  test('takes a vertex coordinate within the snapping distance', () => {
    setup()
    expect(resolveVertexSnap({ x: 260, y: 4 }, vertices, editor).point).toEqual({ x: 260, y: 0 })
    expect(resolveVertexSnap({ x: 260, y: 5 }, vertices, editor)).toEqual({
      point: { x: 260, y: 5 },
      guides: []
    })
  })

  test('runs the guide through every vertex on the line and marks each', () => {
    setup()
    const { guides } = resolveVertexSnap({ x: 300, y: 118 }, vertices, editor)
    expect(guides).toEqual([{ axis: 'y', position: 120, from: 0, to: 300, marks: [300, 0, 200] }])
  })

  test('a point on a vertex shows only that vertex', () => {
    setup()
    expect(resolveVertexSnap({ x: 198, y: 121 }, vertices, editor)).toEqual({
      point: { x: 200, y: 120 },
      guides: [{ axis: 'x', position: 200, from: 120, to: 120, marks: [120] }]
    })
  })

  test('scales the distance with zoom and follows the geometry preference', () => {
    setup()
    editor.state.zoom = 4
    expect(resolveVertexSnap({ x: 260, y: 1.5 }, vertices, editor).guides).toEqual([])
    editor.state.zoom = 1
    editor.state.snappingPreferences = { ...editor.state.snappingPreferences, geometry: false }
    expect(resolveVertexSnap({ x: 260, y: 2 }, vertices, editor).guides).toEqual([])
  })

  test('the cursor and the next point line up with the points already drawn', () => {
    setup()
    click(0, 0)
    click(100, 50)
    updatePenHover(197, 2, editor)
    expect([editor.state.penCursorX, editor.state.penCursorY]).toEqual([197, 0])
    expect(editor.state.snapGuides).toEqual([
      { axis: 'y', position: 0, from: 0, to: 197, marks: [197, 0] }
    ])

    click(197, 2)
    expect(editor.state.penState?.vertices.at(-1)).toEqual({ x: 197, y: 0 })
    expect(editor.state.snapGuides).toEqual([])
  })

  test('leaving the pen drops its guides', () => {
    setup()
    click(0, 0)
    updatePenHover(3, 80, editor)
    expect(editor.state.snapGuides).toHaveLength(1)
    editor.penCancel()
    expect(editor.state.snapGuides).toEqual([])
  })
})
