import { expect, test } from 'bun:test'

import { UndoManager } from '@open-pencil/scene-graph/undo'

test('an open edit records until it is ended, once', () => {
  const undo = new UndoManager()
  expect(undo.isRecording).toBe(false)

  const end = undo.openEdit()
  const other = undo.openEdit()
  expect(undo.isRecording).toBe(true)

  end()
  end()
  expect(undo.isRecording).toBe(true)
  other()
  expect(undo.isRecording).toBe(false)
})

test('a batch records as an open edit does', () => {
  const undo = new UndoManager()
  undo.beginBatch('Drag')
  expect(undo.isRecording).toBe(true)
  undo.commitBatch()
  expect(undo.isRecording).toBe(false)
})
