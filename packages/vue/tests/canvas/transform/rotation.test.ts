import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import {
  cancelRotationDrag,
  commitRotationDrag,
  handleSelectionRotateMove,
  tryStartRotation
} from '#vue/canvas/transform/rotation'
import { selectionBox } from '#vue/shared/input/resize/selection'
import type { DragRotateSelection, DragState } from '#vue/shared/input/types'

let editor: Editor

afterEach(() => editor.dispose())

function place(node: SceneNode | undefined) {
  if (!node) throw new Error('missing layer')
  return {
    x: Math.round(node.x * 1000) / 1000,
    y: Math.round(node.y * 1000) / 1000,
    rotation: Math.round(node.rotation * 1000) / 1000
  }
}

/** Two 50×50 squares at (0,0) and (100,100), both selected: bounds (0,0)…(150,150). */
function setup() {
  editor = createEditor()
  const page = editor.state.currentPageId
  const a = editor.graph.createNode('RECTANGLE', page, { x: 0, y: 0, width: 50, height: 50 })
  const b = editor.graph.createNode('RECTANGLE', page, { x: 100, y: 100, width: 50, height: 50 })
  editor.select([a.id, b.id])
  return { a: a.id, b: b.id }
}

/** Presses the bounds' rotation handle, 24 screen pixels above the top edge's middle. */
function press(cx: number, cy: number) {
  const started: { drag: DragState | null } = { drag: null }
  const hit = tryStartRotation(
    editor,
    (d) => {
      started.drag = d
    },
    cx,
    cy
  )
  return { hit, drag: started.drag }
}

function grabHandle(): DragRotateSelection {
  const { hit, drag } = press(75, -24)
  expect(hit).toBe(true)
  if (drag?.type !== 'rotate-selection') throw new Error('expected a selection rotation')
  return drag
}

describe('rotating a multi-selection', () => {
  test('turns every layer about the bounds’ center', () => {
    const { a, b } = setup()
    const drag = grabHandle()
    // From straight above the center (75, 75) to straight right of it: a quarter turn.
    handleSelectionRotateMove(editor, drag, 175, 75, false)
    expect(place(editor.graph.getNode(a))).toEqual({ x: 100, y: 0, rotation: 90 })
    expect(place(editor.graph.getNode(b))).toEqual({ x: 0, y: 100, rotation: 90 })

    commitRotationDrag(editor, drag)
    expect(place(editor.graph.getNode(b))).toEqual({ x: 0, y: 100, rotation: 90 })
  })

  test('the box stays upright around the turning layers, as Figma draws it', () => {
    setup()
    const drag = grabHandle()
    // An eighth turn: each square's center swings to (75, 75 ∓ 50√2) and its corners reach
    // 25√2 beyond it on every side.
    const radians = (-45 * Math.PI) / 180
    handleSelectionRotateMove(
      editor,
      drag,
      75 + 100 * Math.cos(radians),
      75 + 100 * Math.sin(radians),
      false
    )
    const half = 25 * Math.SQRT2
    const reach = 50 * Math.SQRT2 + half
    const box = selectionBox(editor)
    if (!box) throw new Error('expected a selection box')
    expect(box.x).toBeCloseTo(75 - half, 6)
    expect(box.y).toBeCloseTo(75 - reach, 6)
    expect(box.width).toBeCloseTo(2 * half, 6)
    expect(box.height).toBeCloseTo(2 * reach, 6)
  })

  test('one undo puts every layer back', () => {
    const { a, b } = setup()
    const drag = grabHandle()
    handleSelectionRotateMove(editor, drag, 175, 75, false)
    commitRotationDrag(editor, drag)

    editor.undo.undo()
    expect(place(editor.graph.getNode(a))).toEqual({ x: 0, y: 0, rotation: 0 })
    expect(place(editor.graph.getNode(b))).toEqual({ x: 100, y: 100, rotation: 0 })
  })

  test('Shift snaps the turn to 15° steps', () => {
    const { a } = setup()
    const drag = grabHandle()
    // 50° clockwise from straight up snaps to 45°.
    const radians = ((-90 + 50) * Math.PI) / 180
    handleSelectionRotateMove(
      editor,
      drag,
      75 + 100 * Math.cos(radians),
      75 + 100 * Math.sin(radians),
      true
    )
    expect(place(editor.graph.getNode(a)).rotation).toBe(45)
  })

  test('cancelling puts every layer back', () => {
    const { a, b } = setup()
    const drag = grabHandle()
    handleSelectionRotateMove(editor, drag, 175, 75, false)
    cancelRotationDrag(editor, drag)
    expect(place(editor.graph.getNode(a))).toEqual({ x: 0, y: 0, rotation: 0 })
    expect(place(editor.graph.getNode(b))).toEqual({ x: 100, y: 100, rotation: 0 })
  })

  test('a press away from the handles starts no rotation', () => {
    setup()
    expect(press(75, 75).hit).toBe(false)
  })
})

describe('rotating auto layout children together', () => {
  test('the layout places them while they turn as it does once they are turned', () => {
    editor = createEditor()
    const page = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', page, {
      x: 100,
      y: 100,
      width: 190,
      height: 120,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 20,
      paddingLeft: 20,
      paddingTop: 20
    })
    const a = editor.graph.createNode('RECTANGLE', frame.id, { width: 100, height: 50 })
    const b = editor.graph.createNode('RECTANGLE', frame.id, { width: 50, height: 100 })
    editor.runLayoutForNode(frame.id)
    editor.select([a.id, b.id])
    const box = selectionBox(editor)
    if (!box) throw new Error('expected a selection box')
    const { drag } = press(box.x + box.width / 2, box.y - 24)
    if (drag?.type !== 'rotate-selection') throw new Error('expected a selection rotation')
    // A quarter turn about the box's center.
    handleSelectionRotateMove(
      editor,
      drag,
      box.x + box.width / 2 + 100,
      box.y + box.height / 2,
      false
    )
    const during = [place(editor.graph.getNode(a.id)), place(editor.graph.getNode(b.id))]
    commitRotationDrag(editor, drag)
    expect([place(editor.graph.getNode(a.id)), place(editor.graph.getNode(b.id))]).toEqual(during)
    expect(during.map((layer) => layer.rotation)).toEqual([90, 90])
  })
})
