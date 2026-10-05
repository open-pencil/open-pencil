import { expect, test } from 'bun:test'

import { UndoManager } from '@open-pencil/scene-graph'

test('peeks entries from the top of the undo stack without changing it', () => {
  const undo = new UndoManager()
  const noop = () => undefined
  const first = { label: 'First', forward: noop, inverse: noop }
  const second = { label: 'Second', forward: noop, inverse: noop }
  undo.push(first)
  undo.push(second)

  expect(undo.peekUndo()).toBe(second)
  expect(undo.peekUndo(1)).toBe(first)
  expect(undo.peekUndo(2)).toBeUndefined()
  expect(undo.undoLabel).toBe('Second')

  undo.undo()
  expect(undo.peekUndo()).toBe(first)
})

test('peeks entries from the top of the redo stack, the next Redo first', () => {
  const undo = new UndoManager()
  const noop = () => undefined
  const first = { label: 'First', forward: noop, inverse: noop }
  const second = { label: 'Second', forward: noop, inverse: noop }
  undo.push(first)
  undo.push(second)
  undo.undo()
  undo.undo()

  expect(undo.peekRedo()).toBe(first)
  expect(undo.peekRedo(1)).toBe(second)
  expect(undo.peekRedo(2)).toBeUndefined()
  undo.redo()
  expect(undo.peekRedo()).toBe(second)
})
