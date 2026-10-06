import { expect, test } from 'bun:test'

import { UndoManager } from '@open-pencil/scene-graph'

test('discarding nested batches preserves committed undo/redo without replay or notifications', () => {
  let changes = 0
  let replayed = 0
  const undo = new UndoManager({
    onChange: () => {
      changes++
    }
  })
  const noop = () => undefined
  undo.push({ label: 'First', forward: noop, inverse: noop })
  undo.push({ label: 'Second', forward: noop, inverse: noop })
  undo.undo()
  const pending = {
    label: 'Pending',
    forward: () => {
      replayed++
    },
    inverse: () => {
      replayed++
    }
  }
  undo.beginBatch('Outer')
  undo.push(pending)
  undo.beginBatch('Inner')
  undo.push(pending)
  undo.discardBatches()
  expect(undo.isBatching).toBe(false)
  expect(replayed).toBe(0)
  expect(changes).toBe(3)
  expect(undo.undoLabel).toBe('First')
  expect(undo.redoLabel).toBe('Second')
  undo.commitBatch()
  expect(undo.redo()).toBe('Second')
})
