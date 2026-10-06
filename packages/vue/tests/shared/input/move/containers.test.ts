import { afterEach, describe, expect, test } from 'bun:test'

import { autoLayoutInsertIndex } from '#vue/shared/input/auto-layout'
import { handleMoveMove, handleMoveUp } from '#vue/shared/input/move'
import {
  clickSelectsInside,
  createSelectionMoveDrag,
  pressesSelection
} from '#vue/shared/input/select/move'

import { createMoveHarness, type MoveHarness } from './harness'

// Each case replays an interaction observed in Figma desktop 126 with real pointer input.

let h: MoveHarness

afterEach(() => h.editor.dispose())

function setup() {
  h = createMoveHarness()
  return h
}

function variants() {
  const { node, page } = setup()
  const set = node('COMPONENT_SET', page, { width: 300, height: 140 })
  const variant = node('COMPONENT', set.id, { x: 20, y: 20, width: 60, height: 60 })
  const sibling = node('COMPONENT', set.id, { x: 180, y: 20, width: 100, height: 100 })
  return { set, variant, sibling }
}

describe('component sets', () => {
  test('a variant stays in its set while dropped over it, even onto a sibling', () => {
    const { set, variant } = variants()
    h.drag([variant.id], [50, 50], [100, 70])
    expect(h.parentOf(variant.id)).toBe(set.id)
    h.drag([variant.id], [100, 70], [230, 70])
    expect(h.parentOf(variant.id)).toBe(set.id)
  })

  test('a variant leaves its set for a frame or the page', () => {
    const { variant } = variants()
    const frame = h.node('FRAME', h.page, { x: 500, width: 200, height: 200 })
    h.drag([variant.id], [50, 50], [600, 100])
    expect(h.parentOf(variant.id)).toBe(frame.id)
    h.drag([variant.id], [600, 100], [600, 500])
    expect(h.parentOf(variant.id)).toBe(h.page)
  })

  test('a set does not take components from elsewhere, nor a component another', () => {
    const { set } = variants()
    const loose = h.node('COMPONENT', h.page, { x: 600, width: 60, height: 60 })
    h.drag([loose.id], [630, 30], [150, 100])
    expect(h.parentOf(loose.id)).toBe(h.page)

    const big = h.node('COMPONENT', h.page, { y: 400, width: 200, height: 200 })
    h.drag([loose.id], [150, 100], [100, 500])
    expect(h.parentOf(loose.id)).toBe(h.page)
    expect(h.parentOf(big.id)).toBe(h.page)
    expect(h.childIds(set.id)).toHaveLength(2)
  })
})

describe('Alt-drag duplicates', () => {
  test('a main component becomes an instance at the drop, keeping the name', () => {
    const { node, page, editor } = setup()
    const component = node('COMPONENT', page, { name: 'C', width: 100, height: 100 })
    editor.select([component.id])
    const move = createSelectionMoveDrag(50, 50, 50, 50, editor, true)
    if (move.type !== 'move') throw new Error('Expected a move drag')
    handleMoveMove(move, 300, 50, 300, 50, editor)
    handleMoveUp(move, editor)
    const [copyId] = editor.state.selectedIds
    expect(editor.graph.getNode(copyId)).toMatchObject({
      type: 'INSTANCE',
      componentId: component.id,
      name: 'C',
      x: 250
    })
    expect(editor.graph.getNode(component.id)?.x).toBe(0)
  })
})

describe('groups and booleans', () => {
  function grouped(type: 'GROUP' | 'BOOLEAN_OPERATION' = 'GROUP') {
    const { node, page } = setup()
    const group = node(type, page, { width: 160, height: 160 })
    const a = node('RECTANGLE', group.id, { width: 60, height: 60 })
    const b = node('RECTANGLE', group.id, { x: 100, y: 100, width: 60, height: 60 })
    return { group, a, b }
  }

  test.each(['GROUP', 'BOOLEAN_OPERATION'] as const)(
    '%s fits its children again after one moves, keeping canvas positions',
    (type) => {
      const { group, a, b } = grouped(type)
      h.drag([a.id], [20, 20], [300, 300])
      expect(h.editor.graph.getNode(group.id)).toMatchObject({ x: 100, y: 100, width: 240 })
      expect(h.editor.graph.getAbsolutePosition(a.id)).toEqual({ x: 280, y: 280 })
      expect(h.editor.graph.getAbsolutePosition(b.id)).toEqual({ x: 100, y: 100 })

      h.editor.undoAction()
      expect(h.editor.graph.getNode(group.id)).toMatchObject({ x: 0, y: 0, width: 160 })
      expect(h.editor.graph.getAbsolutePosition(a.id)).toEqual({ x: 0, y: 0 })
    }
  )

  test('a group whose layers all leave goes away, and undo brings it back', () => {
    const { group, a, b } = grouped()
    const frame = h.node('FRAME', h.page, { x: 400, width: 300, height: 300 })
    h.drag([a.id, b.id], [30, 30], [450, 50])
    expect(h.editor.graph.getNode(group.id)).toBeUndefined()
    expect(h.parentOf(a.id)).toBe(frame.id)

    h.editor.undoAction()
    expect(h.childIds(group.id)).toEqual([a.id, b.id])
    expect(h.parentOf(group.id)).toBe(h.page)
  })

  test('nudging a group child fits the group', () => {
    const { group, a } = grouped()
    h.editor.select([a.id])
    h.editor.nudgeSelected(-20, 0)
    h.editor.flushNudge()
    expect(h.editor.graph.getNode(group.id)).toMatchObject({ x: -20, width: 180 })
  })
})

describe('auto layout', () => {
  const flow = { itemSpacing: 10, paddingLeft: 10, paddingTop: 10, paddingRight: 10 }

  test('a child dragged out lands where it was dropped', () => {
    const { node, page, editor } = setup()
    const row = node('FRAME', page, { width: 300, height: 100, layoutMode: 'HORIZONTAL', ...flow })
    const a = node('RECTANGLE', row.id, { width: 60, height: 60 })
    const b = node('RECTANGLE', row.id, { width: 60, height: 60 })
    editor.runLayoutForNode(row.id)
    h.drag([a.id], [40, 40], [500, 300])
    expect(h.parentOf(a.id)).toBe(page)
    expect(editor.graph.getNode(a.id)).toMatchObject({ x: 470, y: 270 })
    expect(editor.graph.getNode(b.id)).toMatchObject({ x: 10, y: 10 })
  })

  test('a wrapped frame inserts on the line under the cursor', () => {
    const { node, page, editor } = setup()
    const wrap = node('FRAME', page, {
      width: 160,
      height: 200,
      layoutMode: 'HORIZONTAL',
      layoutWrap: 'WRAP',
      counterAxisSpacing: 10,
      ...flow
    })
    for (let i = 0; i < 3; i++) node('RECTANGLE', wrap.id, { width: 60, height: 60 })
    editor.runLayoutForNode(wrap.id)
    expect(autoLayoutInsertIndex(wrap, 100, 110, editor, new Set())).toBe(3)
    expect(autoLayoutInsertIndex(wrap, 20, 110, editor, new Set())).toBe(2)
    expect(autoLayoutInsertIndex(wrap, 100, 40, editor, new Set())).toBe(1)
  })
})

describe('pressing inside the selection', () => {
  test('drags a selected container rather than the child under the cursor', () => {
    const { node, page, editor } = setup()
    const outer = node('FRAME', page, { width: 500, height: 500 })
    const nested = node('FRAME', outer.id, { x: 50, y: 50, width: 300, height: 300 })
    const child = node('RECTANGLE', nested.id, { x: 50, y: 50, width: 60, height: 60 })
    editor.select([nested.id])
    expect(pressesSelection(child, 130, 130, editor)).toBe(true)
    // A click without dragging still selects the child of a frame.
    expect(clickSelectsInside(child, editor)).toBe(true)
  })

  test('keeps a selected group child when the group is hit, and a selected group on click', () => {
    const { node, page, editor } = setup()
    const group = node('GROUP', page, { width: 160, height: 160 })
    const a = node('RECTANGLE', group.id, { width: 60, height: 60 })
    editor.select([a.id])
    expect(pressesSelection(group, 20, 20, editor)).toBe(true)
    expect(pressesSelection(group, 120, 120, editor)).toBe(false)
    editor.select([group.id])
    expect(clickSelectsInside(a, editor)).toBe(false)
  })
})
