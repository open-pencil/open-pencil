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
    // The selection's box turns with its layers rather than growing around them.
    // The selection's box turns with its layers rather than growing around them: the same box in
    // a frame turned a quarter, its center still at (75, 75).
    expect(editor.state.selectionRotationPreview).toEqual({
      box: { x: 0, y: -150, width: 150, height: 150 },
      angle: 90
    })

    commitRotationDrag(editor, drag)
    expect(place(editor.graph.getNode(b))).toEqual({ x: 0, y: 100, rotation: 90 })
    expect(editor.state.selectionRotationPreview).toBeNull()
    // The layers now share the angle, so the selection keeps its turned box, as in Figma.
    expect(selectionBox(editor)?.angle).toBeCloseTo(90, 6)
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

describe('a rotated multi-selection’s box', () => {
  /** Squares at 0° and 20°, both selected: their angles differ, so the box starts upright. */
  function mixed() {
    editor = createEditor()
    const page = editor.state.currentPageId
    const a = editor.graph.createNode('RECTANGLE', page, { x: 0, y: 0, width: 50, height: 50 })
    const b = editor.graph.createNode('RECTANGLE', page, {
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      rotation: 20
    })
    editor.select([a.id, b.id])
    return { a: a.id, b: b.id }
  }

  function turnBy(degrees: number) {
    const frame = selectionBox(editor)
    if (!frame) throw new Error('expected a selection box')
    const { box } = frame
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    // Press the stalk straight above the center, then swing the pointer `degrees` around it.
    const { drag } = press(center.x, box.y - 24)
    if (drag?.type !== 'rotate-selection') throw new Error('expected a selection rotation')
    const radians = ((-90 + degrees) * Math.PI) / 180
    const reach = center.y - (box.y - 24)
    handleSelectionRotateMove(
      editor,
      drag,
      center.x + reach * Math.cos(radians),
      center.y + reach * Math.sin(radians),
      false
    )
    commitRotationDrag(editor, drag)
  }

  test('stays turned after release even when the layers’ angles differ', () => {
    mixed()
    expect(selectionBox(editor)?.angle).toBe(0)
    turnBy(30)
    expect(selectionBox(editor)?.angle).toBeCloseTo(30, 6)
  })

  test('undo straightens it with the layers', () => {
    mixed()
    turnBy(30)
    editor.undo.undo()
    expect(selectionBox(editor)?.angle).toBe(0)
  })

  test('another selection forgets it', () => {
    const { a, b } = mixed()
    turnBy(30)
    editor.select([a])
    editor.select([a, b])
    expect(selectionBox(editor)?.angle).toBe(0)
  })
})
