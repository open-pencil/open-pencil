import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { turnPoint } from '@open-pencil/scene-graph/coordinate'

import {
  applySelectionResize,
  cancelSelectionResize,
  commitSelectionResize,
  selectionBox,
  tryStartSelectionResize
} from '#vue/shared/input/resize/selection'

let editor: Editor

afterEach(() => editor.dispose())

function box(node: SceneNode | undefined) {
  if (!node) throw new Error('missing layer')
  return { x: node.x, y: node.y, width: node.width, height: node.height }
}

/** Two 50×50 rectangles at (0,0) and (100,100), both selected: bounds (0,0)…(150,150). */
function setup() {
  editor = createEditor()
  const page = editor.state.currentPageId
  const a = editor.graph.createNode('RECTANGLE', page, { x: 0, y: 0, width: 50, height: 50 })
  const b = editor.graph.createNode('RECTANGLE', page, { x: 100, y: 100, width: 50, height: 50 })
  editor.select([a.id, b.id])
  return { a: a.id, b: b.id }
}

function start(cx: number, cy: number) {
  const drag = tryStartSelectionResize(cx, cy, editor)
  if (!drag) throw new Error('expected a selection resize')
  return drag
}

describe('resizing a multi-selection from its bounds', () => {
  test('the bounds’ corner scales every selected layer', () => {
    const { a, b } = setup()
    const drag = start(150, 150)
    expect(drag.handle).toBe('se')

    applySelectionResize(drag, 300, 300, false, editor)
    expect(box(editor.graph.getNode(a))).toEqual({ x: 0, y: 0, width: 100, height: 100 })
    expect(box(editor.graph.getNode(b))).toEqual({ x: 200, y: 200, width: 100, height: 100 })

    commitSelectionResize(drag, editor)
    expect(box(editor.graph.getNode(b))).toEqual({ x: 200, y: 200, width: 100, height: 100 })
    expect([...editor.state.selectedIds].sort()).toEqual([a, b].sort())
  })

  test('one undo puts every layer back', () => {
    const { a, b } = setup()
    const drag = start(150, 150)
    applySelectionResize(drag, 300, 225, false, editor)
    commitSelectionResize(drag, editor)

    editor.undo.undo()
    expect(box(editor.graph.getNode(a))).toEqual({ x: 0, y: 0, width: 50, height: 50 })
    expect(box(editor.graph.getNode(b))).toEqual({ x: 100, y: 100, width: 50, height: 50 })
  })

  test('Shift keeps the bounds’ proportions', () => {
    const { b } = setup()
    const drag = start(150, 150)
    applySelectionResize(drag, 300, 160, true, editor)
    const node = box(editor.graph.getNode(b))
    expect(node.width).toBeCloseTo(node.height, 6)
    expect(node.x).toBeCloseTo(node.y, 6)
  })

  test('an edge handle scales one axis', () => {
    const { a, b } = setup()
    // The bounds' left edge, midway down.
    const drag = start(0, 75)
    expect(drag.handle).toBe('w')
    applySelectionResize(drag, -150, 75, false, editor)
    expect(box(editor.graph.getNode(a))).toEqual({ x: -150, y: 0, width: 100, height: 50 })
    expect(box(editor.graph.getNode(b))).toEqual({ x: 50, y: 100, width: 100, height: 50 })
  })

  test('cancelling puts every layer back', () => {
    const { a, b } = setup()
    const drag = start(150, 150)
    applySelectionResize(drag, 300, 300, false, editor)
    cancelSelectionResize(drag, editor)
    expect(box(editor.graph.getNode(a))).toEqual({ x: 0, y: 0, width: 50, height: 50 })
    expect(box(editor.graph.getNode(b))).toEqual({ x: 100, y: 100, width: 50, height: 50 })
  })

  test('a press inside the bounds, on a layer’s own corner, starts no resize', () => {
    setup()
    // The first layer's bottom-right corner lies inside the bounds, where no handle is drawn.
    expect(tryStartSelectionResize(50, 50, editor)).toBeNull()
  })
})

describe('resizing a multi-selection inside a group', () => {
  test('the group fits its resized children', () => {
    editor = createEditor()
    const page = editor.state.currentPageId
    const group = editor.graph.createNode('GROUP', page, { x: 0, y: 0, width: 150, height: 150 })
    const a = editor.graph.createNode('RECTANGLE', group.id, { x: 0, y: 0, width: 50, height: 50 })
    const b = editor.graph.createNode('RECTANGLE', group.id, {
      x: 100,
      y: 100,
      width: 50,
      height: 50
    })
    editor.select([a.id, b.id])
    const drag = start(150, 150)
    applySelectionResize(drag, 300, 300, false, editor)
    commitSelectionResize(drag, editor)
    expect(box(editor.graph.getNode(group.id))).toEqual({ x: 0, y: 0, width: 300, height: 300 })

    editor.undo.undo()
    expect(box(editor.graph.getNode(group.id))).toEqual({ x: 0, y: 0, width: 150, height: 150 })
    expect(box(editor.graph.getNode(b.id))).toEqual({ x: 100, y: 100, width: 50, height: 50 })
  })
})

describe('resizing a multi-selection whose layers share an angle', () => {
  test('its turned box resizes along its own axes and the layers keep their angle', () => {
    editor = createEditor()
    const page = editor.state.currentPageId
    const a = editor.graph.createNode('RECTANGLE', page, {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      rotation: 30
    })
    const b = editor.graph.createNode('RECTANGLE', page, {
      x: 100,
      y: 0,
      width: 50,
      height: 50,
      rotation: 30
    })
    editor.select([a.id, b.id])
    const frame = selectionBox(editor)
    if (!frame) throw new Error('expected a selection box')
    expect(frame.angle).toBeCloseTo(30, 6)

    // The box's bottom-right corner, turned onto the canvas.
    const corner = turnPoint(
      { x: frame.box.x + frame.box.width, y: frame.box.y + frame.box.height },
      frame.angle
    )
    const drag = start(corner.x, corner.y)
    expect(drag.handle).toBe('se')
    // 100 along the box's own x axis.
    const along = turnPoint({ x: 100, y: 0 }, frame.angle)
    applySelectionResize(drag, corner.x + along.x, corner.y + along.y, false, editor)
    commitSelectionResize(drag, editor)

    expect(editor.graph.getNode(a.id)?.rotation).toBeCloseTo(30, 6)
    expect(editor.graph.getNode(b.id)?.rotation).toBeCloseTo(30, 6)
    const after = selectionBox(editor)
    expect(after?.angle).toBeCloseTo(30, 6)
    expect(after?.box.width).toBeCloseTo(frame.box.width + 100, 6)
    expect(after?.box.height).toBeCloseTo(frame.box.height, 6)
  })
})
