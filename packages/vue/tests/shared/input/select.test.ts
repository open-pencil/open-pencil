import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'

import { handleMarqueeMove } from '#vue/canvas/transform/marquee'
import { startMarquee, type HitTestFns } from '#vue/shared/input/select'
import type { DragState } from '#vue/shared/input/types'

let editor: Editor

afterEach(() => editor.dispose())

/** Hit-test functions for a press on empty space, with real container bounds. */
function emptySpace(): HitTestFns {
  return {
    hitTestInScope: () => null,
    isInsideContainerBounds: (cx, cy, id) => editor.graph.isPointInNode(id, cx, cy),
    hitTestFrameTitle: () => null,
    hitTestSectionTitle: () => null,
    hitTestComponentLabel: () => null
  }
}

function press(cx: number, cy: number): DragState | null {
  let drag: DragState | null = null
  startMarquee(cx, cy, editor, emptySpace(), (d) => {
    drag = d
  })
  return drag
}

/** A group at (0,0)…(200,200) holding two rectangles, on a page with a third outside it. */
function setup() {
  editor = createEditor()
  const page = editor.state.currentPageId
  const group = editor.graph.createNode('GROUP', page, { x: 0, y: 0, width: 200, height: 200 })
  const a = editor.graph.createNode('RECTANGLE', group.id, { x: 0, y: 0, width: 50, height: 50 })
  const b = editor.graph.createNode('RECTANGLE', group.id, {
    x: 150,
    y: 150,
    width: 50,
    height: 50
  })
  const outside = editor.graph.createNode('RECTANGLE', page, {
    x: 400,
    y: 0,
    width: 50,
    height: 50
  })
  return { group, a, b, outside }
}

describe('marquee from empty space', () => {
  test('inside an entered group, selects among the group’s layers', () => {
    const { group, a, b } = setup()
    editor.enterContainer(group.id)
    editor.select([a.id])

    const drag = press(100, 100)
    expect(drag?.type).toBe('marquee')
    expect(editor.state.enteredContainerId).toBe(group.id)
    expect(editor.state.selectedIds.size).toBe(0)

    if (drag?.type !== 'marquee') throw new Error('expected a marquee')
    handleMarqueeMove(editor, drag, 190, 190)
    expect([...editor.state.selectedIds]).toEqual([b.id])
  })

  test('outside the entered group, leaves it and selects among the page’s layers', () => {
    const { group, outside } = setup()
    editor.enterContainer(group.id)

    const drag = press(300, 10)
    expect(editor.state.enteredContainerId).toBeNull()
    expect(editor.state.selectedIds.size).toBe(0)

    if (drag?.type !== 'marquee') throw new Error('expected a marquee')
    handleMarqueeMove(editor, drag, 420, 20)
    expect([...editor.state.selectedIds]).toEqual([outside.id])
  })
})
