import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

const entry = { label: 'Edit', forward: () => undefined, inverse: () => undefined }

test('publishes history changes independently of scene mutations', () => {
  const editor = createEditor()
  const observed: Array<[boolean, boolean]> = []
  const off = editor.onEditorEvent('history:changed', () => {
    observed.push([editor.undo.canUndo, editor.undo.canRedo])
  })
  const sceneVersion = editor.state.sceneVersion
  try {
    editor.undo.record(entry)
    editor.undo.undo()
    editor.undo.redo()
    editor.undo.clear()
    expect(observed).toEqual([
      [true, false],
      [false, true],
      [true, false],
      [false, false]
    ])
    expect(editor.state.sceneVersion).toBe(sceneVersion)
  } finally {
    off()
    editor.dispose()
  }
})

test('publishes committed batches and coalescing but not pending or rolled-back batches', () => {
  const editor = createEditor()
  const labels: Array<string | null> = []
  const off = editor.onEditorEvent('history:changed', () => labels.push(editor.undo.undoLabel))
  try {
    editor.undo.beginBatch('Cancelled')
    editor.undo.record(entry)
    editor.undo.rollbackBatch()
    expect(labels).toEqual([])
    editor.undo.beginBatch('Batch', 'same-edit')
    editor.undo.record(entry)
    editor.undo.beginBatch('Nested')
    editor.undo.record(entry)
    editor.undo.commitBatch()
    expect(labels).toEqual([])
    editor.undo.commitBatch()
    editor.undo.record({ ...entry, label: 'Coalesced', coalesceKey: 'same-edit' })
    expect(labels).toEqual(['Batch', 'Coalesced'])
  } finally {
    off()
    editor.dispose()
  }
})
