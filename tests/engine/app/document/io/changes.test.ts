import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { createDocumentChanges } from '@/app/document/io/changes'

test('repainting and selection do not dirty a document; content mutations do', () => {
  const editor = createEditor()
  const changes = createDocumentChanges(editor)
  try {
    editor.requestRender()
    editor.requestRepaint()
    editor.clearSelection()
    expect(changes.hasUnsavedChanges()).toBe(false)
    editor.createShape('RECTANGLE', 0, 0, 100, 100)
    expect(changes.hasUnsavedChanges()).toBe(true)
    changes.markSaved()
    expect(changes.hasUnsavedChanges()).toBe(false)
    editor.undo.record({
      label: 'Variable edit',
      forward: () => undefined,
      inverse: () => undefined
    })
    expect(changes.hasUnsavedChanges()).toBe(true)
  } finally {
    changes.dispose()
    editor.dispose()
  }
})

test('saving an earlier revision cannot clear edits made while exporting or picking a file', () => {
  const editor = createEditor()
  const changes = createDocumentChanges(editor)
  try {
    editor.createShape('RECTANGLE', 0, 0, 100, 100)
    const saving = changes.capture()
    editor.createShape('ELLIPSE', 0, 0, 100, 100)
    changes.markSaved(saving)
    expect(changes.hasUnsavedChanges()).toBe(true)
    changes.markSaved()
    expect(changes.hasUnsavedChanges()).toBe(false)
    changes.markChanged()
    expect(changes.hasUnsavedChanges()).toBe(true)
  } finally {
    changes.dispose()
    editor.dispose()
  }
})
