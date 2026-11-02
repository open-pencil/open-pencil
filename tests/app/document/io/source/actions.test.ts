import { afterEach, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createEditorStore, type EditorStore } from '@/app/editor/session'

const CLOUD = { providerId: 'cloud', containerId: 'workspace', documentId: 'document' }

let store: EditorStore

function storedDocument() {
  store = createEditorStore(new SceneGraph())
  store.setStorageDocumentSource(CLOUD, 'Untitled')
  return store
}

afterEach(() => store.dispose())

describe('renaming a document', () => {
  test('marks a stored document changed under its new name', () => {
    storedDocument().renameDocument('  Checkout ')
    expect(store.state.documentName).toBe('Checkout')
    expect(store.hasUnsavedChanges()).toBe(true)
  })

  test('leaves the document saved when the name stays the same or is blank', () => {
    storedDocument().renameDocument(' Untitled ')
    store.renameDocument('   ')
    expect(store.state.documentName).toBe('Untitled')
    expect(store.hasUnsavedChanges()).toBe(false)
  })

  test('keeps a read-only document as it is', () => {
    storedDocument().setReadOnly(true)
    store.renameDocument('Other')
    expect(store.state.documentName).toBe('Untitled')
    expect(store.hasUnsavedChanges()).toBe(false)
  })

  test('shows a new name for a file without calling it unsaved', () => {
    store = createEditorStore(new SceneGraph())
    store.markDocumentSaved()
    store.renameDocument('Checkout')
    expect(store.state.documentName).toBe('Checkout')
    expect(store.hasUnsavedChanges()).toBe(false)
  })
})
