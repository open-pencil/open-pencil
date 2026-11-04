import { expect, test } from 'bun:test'

import { cancelMove, handleMoveMove } from '#vue/shared/input/move/drag'
import { createSelectionMoveDrag } from '#vue/shared/input/select/move'

import { createMoveHarness } from './harness'

function startMove(alt: boolean) {
  const harness = createMoveHarness()
  const { editor, page, node } = harness
  const rect = node('RECTANGLE', page, { x: 10, y: 10 })
  editor.select([rect.id])
  const move = createSelectionMoveDrag(30, 30, 30, 30, editor, alt)
  if (move.type !== 'move') throw new Error('Expected a move drag')
  handleMoveMove(move, 130, 80, 130, 80, editor)
  return { ...harness, rect, move }
}

test('a cancelled move puts the layer back and records nothing', () => {
  const { editor, rect, move } = startMove(false)
  expect(editor.graph.getNode(rect.id)?.x).not.toBe(10)

  cancelMove(move, editor)
  expect(editor.graph.getNode(rect.id)).toMatchObject({ x: 10, y: 10 })
  expect(editor.undo.canUndo).toBe(false)
})

test('a cancelled duplicate removes its copies and selects the original again', () => {
  const { editor, page, rect, move } = startMove(true)
  expect(editor.graph.getChildren(page)).toHaveLength(2)

  cancelMove(move, editor)
  expect(editor.graph.getChildren(page).map((child) => child.id)).toEqual([rect.id])
  expect([...editor.state.selectedIds]).toEqual([rect.id])
})
