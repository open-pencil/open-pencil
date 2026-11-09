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
