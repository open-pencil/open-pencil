import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { executeWithDocumentUndo } from '@/app/automation/execution/editor'
import { createEditorStore, type EditorStore } from '@/app/editor/session/create'

let store: EditorStore

beforeEach(() => {
  Object.assign(globalThis, { window: { innerWidth: 1024, innerHeight: 768 } })
  store = createEditorStore(new SceneGraph())
})

afterEach(() => {
  store.dispose()
  Reflect.deleteProperty(globalThis, 'window')
})

test('undoing an automation edit that awaits returns the document to saved', async () => {
  const pageId = store.state.currentPageId
  store.markDocumentSaved()

  await executeWithDocumentUndo(store, pageId, 'Agent: eval', async () => {
    await Promise.resolve()
    store.graph.createNode('RECTANGLE', pageId, { width: 40, height: 20 })
    await Promise.resolve()
  })
  await Promise.resolve()
  expect(store.hasUnsavedChanges()).toBe(true)

  expect(store.undo.undo()).toBe('Agent: eval')
  await Promise.resolve()
  expect(store.graph.getChildren(pageId)).toEqual([])
  expect(store.hasUnsavedChanges()).toBe(false)
})
