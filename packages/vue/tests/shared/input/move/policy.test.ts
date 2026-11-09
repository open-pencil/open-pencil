import { afterEach, expect, test } from 'bun:test'

import type { Editor } from '@open-pencil/core'

import { handleMoveMove, handleMoveUp } from '#vue/shared/input/move/drag'
import { createSelectionMoveDrag } from '#vue/shared/input/select/move'

import { createMoveHarness } from './harness'

let editor: Editor

afterEach(() => editor.dispose())

// A host's move policy decides a drag while it previews, not only when it lands: a layer kept on
// its line never leaves it, even for a frame.
test('a drag follows the move policy in its preview and as it lands', () => {
  const harness = createMoveHarness()
  editor = harness.editor
  editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
  const piece = harness.node('RECTANGLE', harness.page, { x: 0, y: 100 })
  editor.setMovePolicy(({ to }) => ({ x: to.x, y: 100 }))

  editor.select([piece.id])
  const drag = createSelectionMoveDrag(20, 120, 20, 120, editor, false)
  if (drag.type !== 'move') throw new Error('Expected a move drag')
  handleMoveMove(drag, 50, 160, 50, 160, editor)
  expect(editor.graph.getNode(piece.id)).toMatchObject({ x: 30, y: 100 })
  handleMoveUp(drag, editor)
  expect(editor.graph.getNode(piece.id)).toMatchObject({ x: 30, y: 100 })

  editor.undoAction()
  expect(editor.graph.getNode(piece.id)).toMatchObject({ x: 0, y: 100 })
})

test('a landing the host refuses changes nothing, not even the parent the drop was over', () => {
  const harness = createMoveHarness()
  editor = harness.editor
  editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
  const frame = harness.node('FRAME', harness.page, { x: 200, y: 0, width: 200, height: 200 })
  const piece = harness.node('RECTANGLE', harness.page, { x: 0, y: 0 })
  // Previews follow the pointer; the landing is refused.
  editor.setMovePolicy(({ to, preview }) => (preview ? to : null))

  editor.select([piece.id])
  const drag = createSelectionMoveDrag(20, 20, 20, 20, editor, false)
  if (drag.type !== 'move') throw new Error('Expected a move drag')
  handleMoveMove(drag, 260, 60, 260, 60, editor)
  expect(editor.graph.getNode(piece.id)).toMatchObject({ x: 240, y: 40 })
  handleMoveUp(drag, editor)
  expect(editor.graph.getNode(piece.id)).toMatchObject({ x: 0, y: 0, parentId: harness.page })
  expect(harness.childIds(frame.id)).toEqual([])
  expect(editor.undo.canUndo).toBe(false)
})

test('a preview the host refuses shows the layer where the drag found it', () => {
  const harness = createMoveHarness()
  editor = harness.editor
  editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
  const piece = harness.node('RECTANGLE', harness.page, { x: 0, y: 0 })
  // Moves up to x = 50 are allowed; past it, refused.
  editor.setMovePolicy(({ to }) => ((to.x ?? 0) <= 50 ? to : null))

  editor.select([piece.id])
  const drag = createSelectionMoveDrag(20, 20, 20, 20, editor, false)
  if (drag.type !== 'move') throw new Error('Expected a move drag')
  handleMoveMove(drag, 50, 20, 50, 20, editor)
  expect(editor.graph.getNode(piece.id)?.x).toBe(30)
  handleMoveMove(drag, 120, 20, 120, 20, editor)
  expect(editor.graph.getNode(piece.id)?.x).toBe(0)
})

test('the landing is decided once, and an axis the preview leaves out shows the start', () => {
  const harness = createMoveHarness()
  editor = harness.editor
  editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
  const piece = harness.node('RECTANGLE', harness.page, { x: 0, y: 0 })
  // Each landing takes the next free slot; previews keep the layer on x alone.
  const slots = [
    { x: 100, y: 0 },
    { x: 200, y: 0 }
  ]
  let landings = 0
  editor.setMovePolicy(({ to, preview }) => (preview ? { x: to.x } : (slots[landings++] ?? null)))

  editor.select([piece.id])
  const drag = createSelectionMoveDrag(20, 20, 20, 20, editor, false)
  if (drag.type !== 'move') throw new Error('Expected a move drag')
  handleMoveMove(drag, 60, 80, 60, 80, editor)
  expect(editor.graph.getNode(piece.id)).toMatchObject({ x: 40, y: 0 })
  handleMoveUp(drag, editor)
  expect(landings).toBe(1)
  expect(editor.graph.getNode(piece.id)).toMatchObject({ x: 100, y: 0 })
})

test('a drop the host refuses for one of its layers changes no parent, and moves the others', () => {
  const harness = createMoveHarness()
  editor = harness.editor
  editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
  const frame = harness.node('FRAME', harness.page, { x: 200, y: 0, width: 300, height: 300 })
  const kept = harness.node('RECTANGLE', harness.page, { x: 0, y: 0 })
  const moved = harness.node('RECTANGLE', harness.page, { x: 0, y: 60 })
  editor.setMovePolicy(({ node, to }) => (node.id === kept.id ? null : to))

  editor.select([kept.id, moved.id])
  const drag = createSelectionMoveDrag(20, 20, 20, 20, editor, false)
  if (drag.type !== 'move') throw new Error('Expected a move drag')
  handleMoveMove(drag, 260, 60, 260, 60, editor)
  handleMoveUp(drag, editor)
  expect(editor.graph.getNode(kept.id)).toMatchObject({ x: 0, y: 0, parentId: harness.page })
  expect(editor.graph.getNode(moved.id)).toMatchObject({ x: 240, y: 100, parentId: harness.page })
  expect(harness.childIds(frame.id)).toEqual([])
})
