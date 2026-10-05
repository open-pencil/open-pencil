import { afterEach, describe, expect, test } from 'bun:test'

import type { Editor } from '@open-pencil/core/editor'

import { createMoveHarness, type MoveHarness } from './harness'

// Each case replays a drag observed in Figma desktop 126 with real pointer input.

let h: MoveHarness
let editor: Editor

afterEach(() => editor.dispose())

function setup() {
  h = createMoveHarness()
  editor = h.editor
  return h.page
}

const node: MoveHarness['node'] = (...args) => h.node(...args)
const drag: MoveHarness['drag'] = (...args) => h.drag(...args)
const parentOf: MoveHarness['parentOf'] = (id) => h.parentOf(id)

describe('dropping moved layers', () => {
  test('nests a layer when the cursor is inside a frame, however little of it is', () => {
    const page = setup()
    const frame = node('FRAME', page, { width: 200, height: 200 })
    const box = node('RECTANGLE', page, { x: 400, width: 100, height: 100 })
    drag([box.id], [405, 5], [190, 100])
    expect(parentOf(box.id)).toBe(frame.id)
  })

  test('takes a layer out of its frame as soon as the cursor leaves it', () => {
    const page = setup()
    const frame = node('FRAME', page, { width: 200, height: 200 })
    const child = node('RECTANGLE', frame.id, { x: 160, y: 80 })
    drag([child.id], [198, 100], [212, 100])
    expect(parentOf(child.id)).toBe(page)
    expect(editor.graph.getAbsolutePosition(child.id)).toEqual({ x: 174, y: 80 })

    editor.undoAction()
    expect(parentOf(child.id)).toBe(frame.id)
  })

  test('keeps a layer in its group unless it lands on another frame', () => {
    const page = setup()
    const group = node('GROUP', page, { width: 200, height: 200 })
    const child = node('RECTANGLE', group.id)
    drag([child.id], [20, 20], [400, 100])
    expect(parentOf(child.id)).toBe(group.id)

    const frame = node('FRAME', page, { x: 600, width: 200, height: 200 })
    drag([child.id], [400, 100], [700, 100])
    expect(parentOf(child.id)).toBe(frame.id)
  })

  test('never drops into groups or locked frames', () => {
    const page = setup()
    node('GROUP', page, { width: 200, height: 200 })
    node('FRAME', page, { x: 300, width: 200, height: 200, locked: true })
    const box = node('RECTANGLE', page, { x: 600 })
    drag([box.id], [620, 20], [100, 100])
    expect(parentOf(box.id)).toBe(page)
    drag([box.id], [100, 100], [400, 100])
    expect(parentOf(box.id)).toBe(page)
  })

  test('leaves locked layers of a mixed selection in place', () => {
    const page = setup()
    const free = node('RECTANGLE', page)
    const locked = node('RECTANGLE', page, { x: 100, locked: true })
    drag([free.id, locked.id], [20, 20], [20, 120])
    expect(editor.graph.getNode(free.id)?.y).toBe(100)
    expect(editor.graph.getNode(locked.id)?.y).toBe(0)
  })

  test('keeps parents while Space is held', () => {
    const page = setup()
    const frame = node('FRAME', page, { width: 200, height: 200 })
    const other = node('FRAME', page, { x: 300, width: 200, height: 200 })
    const child = node('RECTANGLE', frame.id, { x: 80, y: 80 })
    const keepParents = (move: { keepParents?: boolean }) => {
      move.keepParents = true
    }
    drag([child.id], [100, 100], [400, 100], {}, keepParents)
    expect(parentOf(child.id)).toBe(frame.id)
    expect(editor.graph.getAbsolutePosition(child.id).x).toBe(380)
    expect(editor.graph.getChildren(other.id)).toHaveLength(0)
  })

  test('Shift locks the move to its longer axis', () => {
    const page = setup()
    const box = node('RECTANGLE', page, { x: 400, y: 50 })
    drag([box.id], [420, 70], [520, 160], { shiftKey: true })
    expect(editor.graph.getNode(box.id)).toMatchObject({ x: 500, y: 50 })
    drag([box.id], [520, 70], [550, 170], { shiftKey: true })
    expect(editor.graph.getNode(box.id)).toMatchObject({ x: 500, y: 150 })
  })

  test('Control drops into auto layout as an absolute-positioned layer', () => {
    const page = setup()
    const row = node('FRAME', page, { width: 300, height: 100, layoutMode: 'HORIZONTAL' })
    const box = node('RECTANGLE', page, { x: 400, y: 50 })
    drag([box.id], [420, 70], [75, 50], { ctrlKey: true })
    expect(parentOf(box.id)).toBe(row.id)
    expect(editor.graph.getNode(box.id)).toMatchObject({
      layoutPositioning: 'ABSOLUTE',
      x: 55,
      y: 30
    })

    editor.undoAction()
    expect(parentOf(box.id)).toBe(page)
    expect(editor.graph.getNode(box.id)?.layoutPositioning).toBe('AUTO')
  })

  test('Control puts a layer from elsewhere at the cursor among auto layout children', () => {
    const page = setup()
    const row = node('FRAME', page, { width: 300, height: 100, layoutMode: 'HORIZONTAL' })
    const a = node('RECTANGLE', row.id, { name: 'a', x: 10, y: 10, width: 60, height: 60 })
    const b = node('RECTANGLE', row.id, { name: 'b', x: 80, y: 10, width: 60, height: 60 })
    const box = node('RECTANGLE', page, { x: 400, y: 50 })
    const order = () => editor.graph.getChildren(row.id).map((child) => child.id)

    drag([box.id], [420, 70], [75, 50], { ctrlKey: true })
    expect(order()).toEqual([a.id, box.id, b.id])

    editor.undoAction()
    expect(order()).toEqual([a.id, b.id])
    expect(parentOf(box.id)).toBe(page)

    editor.redoAction()
    expect(order()).toEqual([a.id, box.id, b.id])
    expect(editor.graph.getNode(box.id)).toMatchObject({ x: 55, y: 30 })
  })

  test('Control puts a layer already in the auto layout frame on top', () => {
    const page = setup()
    const row = node('FRAME', page, { width: 300, height: 100, layoutMode: 'HORIZONTAL' })
    const a = node('RECTANGLE', row.id, { x: 10, y: 10, width: 60, height: 60 })
    const b = node('RECTANGLE', row.id, { x: 80, y: 10, width: 60, height: 60 })
    drag([a.id], [40, 40], [60, 60], { ctrlKey: true })
    expect(editor.graph.getChildren(row.id).map((child) => child.id)).toEqual([b.id, a.id])
    expect(editor.graph.getNode(a.id)).toMatchObject({
      layoutPositioning: 'ABSOLUTE',
      x: 30,
      y: 30
    })
  })

  test('a moved section adopts the layers it fully covers', () => {
    const page = setup()
    const section = node('SECTION', page, { x: 400, width: 200, height: 200 })
    const covered = node('RECTANGLE', page, { x: 50, y: 50 })
    const partial = node('RECTANGLE', page, { x: 180, y: 50, width: 60 })
    drag([section.id], [500, 100], [100, 100])
    expect(parentOf(covered.id)).toBe(section.id)
    expect(parentOf(partial.id)).toBe(page)

    editor.undoAction()
    expect(parentOf(covered.id)).toBe(page)
    expect(editor.graph.getNode(section.id)?.x).toBe(400)
  })
})
