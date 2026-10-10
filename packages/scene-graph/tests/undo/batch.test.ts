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

// A picker coalesces its changes into one batch until it goes idle; ⌘Z pressed before that must
// undo those changes, not the edit before them.
test('undo commits an edit still being coalesced and undoes it first', () => {
  const undo = new UndoManager()
  const values: string[] = []
  const entry = (label: string) => ({
    label,
    forward: () => values.push(`redo ${label}`),
    inverse: () => values.push(`undo ${label}`)
  })
  undo.push(entry('Earlier'))
  undo.beginBatch('Change fill')
  undo.push(entry('Picker'))
  const stop = undo.onBeforeHistory(() => {
    if (undo.isBatching) undo.commitBatch()
  })

  expect(undo.undo()).toBe('Change fill')
  expect(values).toEqual(['undo Picker'])
  stop()
  expect(undo.undo()).toBe('Earlier')
})

// The picker's first change in a document with no history yet must still be undoable.
test('a pending batch that will settle counts as undoable', () => {
  const undo = new UndoManager()
  const noop = () => undefined
  undo.beginBatch('Change fill')
  undo.push({ label: 'Picker', forward: noop, inverse: noop })
  expect(undo.canUndo).toBe(false)
  undo.onBeforeHistory(() => {
    if (undo.isBatching) undo.commitBatch()
  })
  expect(undo.canUndo).toBe(true)
  expect(undo.undo()).toBe('Change fill')
})
