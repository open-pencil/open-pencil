import { afterEach, describe, expect, test } from 'bun:test'

import { mapValues } from 'es-toolkit'

import { createEditor, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import {
  applySelectionResize,
  cancelSelectionResize,
  commitSelectionResize,
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

describe('stretching a multi-selection with a turned layer', () => {
  /** A square turned 45° beside an upright one; the box's right edge is at x 200. */
  function turned() {
    editor = createEditor()
    const page = editor.state.currentPageId
    const a = editor.graph.createNode('RECTANGLE', page, {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      rotation: 45
    })
    const b = editor.graph.createNode('RECTANGLE', page, { x: 150, y: 0, width: 50, height: 50 })
    editor.select([a.id, b.id])
    return { a: a.id, b: b.id }
  }

  test('turns the layer as Figma reports it, and one undo puts its angle back', () => {
    const { a } = turned()
    const drag = start(200, 25)
    expect(drag.handle).toBe('e')
    // Doubling the box's width stretches the turned square's axes to (2, 1) and (−2, 1) over √2.
    applySelectionResize(drag, 200 + drag.origBounds.width, 25, false, editor)
    commitSelectionResize(drag, editor)
    const node = editor.graph.getNode(a)
    expect(node?.rotation).toBeCloseTo((Math.atan2(1, 2) * 180) / Math.PI, 6)
    expect(node?.width).toBeCloseTo((50 * Math.sqrt(5)) / Math.SQRT2, 6)

    editor.undo.undo()
    expect(editor.graph.getNode(a)?.rotation).toBe(45)
    expect(box(editor.graph.getNode(a))).toEqual({ x: 0, y: 0, width: 50, height: 50 })
  })

  test('cancelling puts its angle back', () => {
    const { a } = turned()
    const drag = start(200, 25)
    applySelectionResize(drag, 200 + drag.origBounds.width, 25, false, editor)
    cancelSelectionResize(drag, editor)
    expect(editor.graph.getNode(a)?.rotation).toBe(45)
    expect(box(editor.graph.getNode(a))).toEqual({ x: 0, y: 0, width: 50, height: 50 })
  })
})

describe('dragging a multi-selection’s edge past the opposite one', () => {
  test('mirrors the selection: the layers swap sides and each is flipped, in one undo step', () => {
    const { a, b } = setup()
    // The right edge from x 150 to x −75: the box mirrors to −75…0, at half its width.
    const drag = start(150, 75)
    applySelectionResize(drag, -75, 75, false, editor)
    commitSelectionResize(drag, editor)
    const world = (id: string) => {
      const node = editor.graph.getNode(id)
      if (!node) throw new Error('missing layer')
      const bounds = getAxisAlignedWorldBounds(node, editor.graph)
      return mapValues(bounds, (value) => Math.round(value * 1e6) / 1e6)
    }
    expect(world(a)).toEqual({ x: -25, y: 0, width: 25, height: 50 })
    expect(world(b)).toEqual({ x: -75, y: 100, width: 25, height: 50 })
    // Drawn mirrored: the layer's own x axis now runs right to left on the canvas.
    const node = editor.graph.getNode(a)
    if (!node) throw new Error('missing layer')
    const [x0, , x1] = Matrix.mapPoints(getWorldMatrix(node, editor.graph), [0, 0, 1, 0])
    expect(x1).toBeLessThan(x0)

    editor.undo.undo()
    expect(box(editor.graph.getNode(a))).toEqual({ x: 0, y: 0, width: 50, height: 50 })
    expect(editor.graph.getNode(a)?.rotation).toBe(0)
    expect(editor.graph.getNode(a)?.flipY).toBe(false)
  })
})
