import { afterEach, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createMemoryRecoveryStore } from '@/app/document/recovery/memory'
import { resetRecoveryStoreForTests } from '@/app/document/recovery/store'
import { createEditorStore, type EditorStore } from '@/app/editor/session'

let store: EditorStore

/** A granted file the watcher can read; the test never writes to it. */
function fileHandle(): FileSystemFileHandle {
  const file = new File([new Uint8Array()], 'Checkout.fig', { lastModified: 1 })
  return { kind: 'file', name: 'Checkout.fig', getFile: async () => file } as FileSystemFileHandle
}

async function editFileDocument(autosave: boolean) {
  const recovery = createMemoryRecoveryStore()
  resetRecoveryStoreForTests(recovery)
  store = createEditorStore(new SceneGraph())
  store.setDocumentSource('Checkout.fig', 'fig', fileHandle())
  store.state.autosaveEnabled = autosave
  store.markDocumentChanged()
  await store.persistRecoveryNow()
  return recovery
}

afterEach(() => {
  store.dispose()
  resetRecoveryStoreForTests()
})

describe('recovery of a document opened from a file', () => {
  test('keeps a copy of unsaved edits while autosave is off', async () => {
    const recovery = await editFileDocument(false)
    expect((await recovery.list()).map((copy) => copy.id)).toEqual([store.getRecoveryId()])
  })

  test('leaves the edits to autosave while it is on', async () => {
    const recovery = await editFileDocument(true)
    expect(await recovery.list()).toEqual([])
  })
})
