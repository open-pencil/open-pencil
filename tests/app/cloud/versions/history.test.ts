import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import {
  closeVersionHistory,
  isVersionHistoryOpen,
  openVersionDialog,
  openVersionHistory,
  shownEditorStore,
  versionDialog,
  versionListRevision,
  versionPreviewKey,
  versionsChanged
} from '@/app/cloud/versions/history'
import { createEditorStore } from '@/app/editor/session/create'

// Figma desktop, version history (2026-10-17): the file is read-only while the panel is open,
// even on Current version, and editable again once it closes.

describe('version history', () => {
  test('keeps the document read-only while it is open', () => {
    const store = createEditorStore()
    openVersionHistory(store)
    expect(isVersionHistoryOpen(store)).toBe(true)
    expect(store.state.readOnly).toBe(true)
    expect(shownEditorStore(store)).toBe(store)
    expect(versionPreviewKey(store)).toBe('')

    closeVersionHistory(store)
    expect(isVersionHistoryOpen(store)).toBe(false)
    expect(store.state.readOnly).toBe(false)
  })

  test('leaves a viewer’s document read-only after closing', () => {
    const store = createEditorStore()
    store.setReadOnly(true)
    openVersionHistory(store)
    closeVersionHistory(store)
    expect(store.state.readOnly).toBe(true)
  })

  test('reloads only the list of the document whose history changed', () => {
    const changed = createEditorStore()
    const other = createEditorStore()
    const before = [versionListRevision(changed), versionListRevision(other)]
    versionsChanged(changed)
    expect([versionListRevision(changed), versionListRevision(other)]).toEqual([
      (before[0] ?? 0) + 1,
      before[1]
    ])
  })

  test('opens the version dialog for the document, without opening the history', () => {
    const store = createEditorStore()
    openVersionDialog(store)
    expect(versionDialog.value).toEqual({ store, version: null })
    expect(isVersionHistoryOpen(store)).toBe(false)
    versionDialog.value = null
  })
})
