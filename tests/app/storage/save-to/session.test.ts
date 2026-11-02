import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { markRaw, reactive } from 'vue'

import { createEditorStore } from '@/app/editor/session/create'
import type { StorageDocumentBinding, StorageLocation } from '@/app/integrations/storage'
import { createMemoryLocalCanvasStore, type LocalCanvasStore } from '@/app/storage/local-store'
import { resetLocalCanvasStoreForTests } from '@/app/storage/local-store/store'
import type { SaveDestination } from '@/app/storage/save-to/model'
import {
  closeSaveTo,
  confirmSaveTo,
  saveToSession,
  type SaveToSession
} from '@/app/storage/save-to/session'
import { createMemoryOutbox, getOutbox, resetOutboxForTests } from '@/app/storage/sync'
import { PARKED_ATTEMPT_AT } from '@/app/storage/sync/types'

const bucket: SaveDestination = {
  key: 's3-compatible/default/',
  location: { providerId: 's3-compatible' },
  label: 'studio-designs',
  kind: 'bucket',
  place: null
}

let canvases: LocalCanvasStore

beforeEach(() => {
  canvases = createMemoryLocalCanvasStore()
  resetLocalCanvasStoreForTests(canvases)
  resetOutboxForTests(createMemoryOutbox())
})

afterEach(() => {
  saveToSession.value = null
  resetLocalCanvasStoreForTests()
  resetOutboxForTests()
})

/** An editor whose save to storage writes this device's copy as `upload` leaves it. */
function editorSaving(upload: 'uploaded' | 'waiting' | 'parked' | 'throws') {
  const store = createEditorStore()
  store.state.documentName = 'Draft'
  let binding: StorageDocumentBinding | null = null
  Object.assign(store, {
    getStorageBinding: () => binding,
    saveFigFileToStorage: async (location: StorageLocation) => {
      if (upload === 'throws') throw new Error('The device is out of space')
      binding = { ...location, documentId: 'doc' }
      await canvases.writeCanvas({
        ...location,
        id: 'doc',
        name: store.state.documentName,
        figBytes: new Uint8Array(64),
        syncStatus: upload === 'uploaded' ? 'synced' : 'pending'
      })
      if (upload === 'parked') {
        const job = await getOutbox().enqueue({ canvasId: 'doc', type: 'putCanvas', revision: 1 })
        await getOutbox().update({ ...job, nextAttemptAt: PARKED_ATTEMPT_AT })
      }
      return true
    }
  })
  return store
}

function startSession(store: ReturnType<typeof createEditorStore>, name = 'Poster') {
  const session: SaveToSession = reactive({
    store: markRaw(store),
    destinations: [bucket],
    name,
    chosen: bucket.key,
    state: { kind: 'ready' },
    open: true,
    following: markRaw(new AbortController())
  })
  saveToSession.value = session
  return session
}

describe('Save to', () => {
  test('closes once the document is on its storage, under its new name', async () => {
    const store = editorSaving('uploaded')
    const session = startSession(store)
    await confirmSaveTo()
    expect(session.open).toBe(false)
    expect(session.state).toEqual({ kind: 'ready' })
    expect(store.state.documentName).toBe('Poster')
  })

  test('keeps the old name and says so when nothing could be saved', async () => {
    const store = editorSaving('throws')
    const session = startSession(store)
    await confirmSaveTo()
    expect(store.state.documentName).toBe('Draft')
    expect(session.state).toEqual({ kind: 'error', reason: 'unavailable' })
    expect(session.open).toBe(true)
  })

  test('shows a failure when the upload stops for the person', async () => {
    const session = startSession(editorSaving('parked'))
    await confirmSaveTo()
    expect(session.state).toEqual({ kind: 'error', reason: 'unavailable' })
    expect(session.open).toBe(true)
  })

  test('lets the upload go on in the background when the dialog closes', async () => {
    const session = startSession(editorSaving('waiting'))
    const saving = confirmSaveTo()
    while (!(await canvases.getMeta('doc'))) await Bun.sleep(1)
    closeSaveTo()
    await saving
    expect(session.open).toBe(false)
    expect(session.state).toEqual({ kind: 'ready' })
  })
})
