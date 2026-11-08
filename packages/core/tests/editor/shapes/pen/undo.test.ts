import { afterEach, beforeEach, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'

import { expectDefined } from '@open-pencil/test-support/assert'

let editor: Editor

beforeEach(() => {
  editor = createEditor()
  editor.setTool('PEN')
})

afterEach(() => editor.dispose())

const points = () => editor.state.penState?.vertices.map(({ x, y }) => [x, y]) ?? null
const vectors = () =>
  editor.graph
    .getChildren(editor.state.currentPageId)
    .filter((node) => node.type === 'VECTOR')
    .map((node) => node.id)

/** Presses as the canvas does: each press starts a step, then places its point. */
function press(x: number, y: number, drag?: [number, number]) {
  editor.penPushHistory()
  editor.penAddVertex(x, y)
  if (drag) editor.penSetDragTangent(...drag)
}

test('undo takes back the last point while drawing, and redo puts it back', () => {
  press(0, 0)
  press(100, 0)
  press(100, 100)

  editor.undoAction()
  expect(points()).toEqual([
    [0, 0],
    [100, 0]
  ])
  editor.undoAction()
  expect(points()).toEqual([[0, 0]])
  editor.redoAction()
  expect(points()).toEqual([
    [0, 0],
    [100, 0]
  ])
})

test('a point and the drag that shapes its handles are one step', () => {
  press(0, 0)
  press(100, 0, [30, 40])
  press(100, 100)

  editor.undoAction()
  const segment = expectDefined(editor.state.penState?.segments.at(-1))
  expect(segment.tangentEnd).toEqual({ x: -30, y: -40 })
  expect(editor.state.penState?.dragTangent).toEqual({ x: 30, y: 40 })
  editor.undoAction()
  expect(points()).toEqual([[0, 0]])
})

test('a new point after undo drops what redo would have put back', () => {
  press(0, 0)
  press(100, 0)
  editor.undoAction()
  press(0, 100)
  editor.redoAction()
  expect(points()).toEqual([
    [0, 0],
    [0, 100]
  ])
})

test('undo past the first point leaves the pen with nothing drawn', () => {
  press(0, 0)
  editor.undoAction()
  expect(editor.state.penState).toBeNull()
  expect(editor.state.activeTool).toBe('PEN')
})

test('undo after the path ends draws on from its last point', () => {
  press(0, 0)
  press(100, 0)
  press(100, 100)
  editor.penCommit(false)
  expect(vectors()).toHaveLength(1)

  editor.undoAction()
  expect(vectors()).toHaveLength(0)
  expect(editor.state.activeTool).toBe('PEN')
  expect(points()).toHaveLength(3)
  editor.undoAction()
  expect(points()).toHaveLength(2)

  press(0, 100)
  editor.penCommit(false)
  const [id] = vectors()
  const network = expectDefined(editor.graph.getNode(expectDefined(id))?.vectorNetwork)
  expect(network.vertices).toHaveLength(3)
})

test('redo ends the path again', () => {
  press(0, 0)
  press(100, 0)
  editor.penCommit(false)
  editor.undoAction()
  editor.redoAction()

  expect(editor.state.penState).toBeNull()
  expect(editor.state.activeTool).toBe('SELECT')
  expect(vectors()).toHaveLength(1)
})

test('one undo takes back a close and the press that made it', () => {
  press(0, 0)
  press(100, 0)
  press(100, 100)
  editor.penPushHistory()
  editor.penSetPendingClose(true)
  editor.penSetDragTangent(0, -30)
  editor.penCommit(true)

  editor.undoAction()
  expect(vectors()).toHaveLength(0)
  expect(points()).toHaveLength(3)
  expect(editor.state.penState?.pendingClose).toBe(false)
  expect(editor.state.penState?.segments).toHaveLength(2)
})

test('undo brings back a path dropped while drawing', () => {
  press(0, 0)
  press(100, 0)
  editor.penCancel()
  expect(editor.state.penState).toBeNull()

  editor.undoAction()
  expect(points()).toHaveLength(2)
  expect(editor.state.activeTool).toBe('PEN')
})

test('a press taken back leaves no step, and redo keeps what it had', () => {
  press(0, 0)
  press(100, 0)
  editor.undoAction()
  press(100, 100, [20, 0])
  editor.penCancelPress()
  expect(points()).toEqual([[0, 0]])

  editor.redoAction()
  expect(points()).toEqual([
    [0, 0],
    [100, 0]
  ])
  editor.undoAction()
  editor.undoAction()
  expect(editor.state.penState).toBeNull()
})
