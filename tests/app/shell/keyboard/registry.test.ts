import { describe, expect, test } from 'bun:test'

import type { EditorPreparation } from '@/app/editor/preparation/types'
import { createEditorStore } from '@/app/editor/session'
import { appShortcuts, keysHeldWhilePreparing } from '@/app/shell/keyboard/registry'

const noop = () => undefined

function shortcuts() {
  return appShortcuts({
    store: createEditorStore(),
    actions: { toggleUI: noop, togglePlay: noop, toggleAI: noop, exportSelectionPNG: noop },
    openFileDialog: noop,
    closeActiveTab: noop,
    createTab: noop,
    openNewFileTab: noop,
    switchAdjacentTab: noop
  })
}

describe('app shortcuts', () => {
  // Held back while text is edited or a field has focus, Mod+S would reach the browser, which
  // offers to save the page; global keys run there and stop it (`useEditorKeyboard`).
  test('registers save and save as as global keys', () => {
    const registered = shortcuts()
    for (const id of ['save', 'save-as']) {
      expect(registered.find((shortcut) => shortcut.id === id)?.global).toBe(true)
    }
  })
})

function preparation(kind: EditorPreparation['kind']): EditorPreparation {
  return {
    id: 1,
    kind,
    phase: 'reading',
    subject: 'Karbid.fig',
    detail: null,
    progress: null,
    startedAt: 0
  }
}

describe('keys while a document is prepared', () => {
  test('an editor with nothing loading takes its keys', () => {
    const store = createEditorStore()

    expect(keysHeldWhilePreparing(store)()).toBe(false)
  })

  test('a document being read or replaced takes none of them', () => {
    const store = createEditorStore()
    const held = keysHeldWhilePreparing(store)

    // Whichever way the loader came up, a key pressed now would edit the document it replaces.
    for (const kind of ['document-reload', 'document-open', 'page-switch'] as const) {
      store.state.preparation = preparation(kind)
      expect(held()).toBe(true)
    }
  })

  test('a font retry keeps the keys, since the document stays the one on screen', () => {
    const store = createEditorStore()
    const held = keysHeldWhilePreparing(store)

    store.state.preparation = preparation('font-retry')

    expect(held()).toBe(false)
  })

  test('the keys come back once the loader is gone', () => {
    const store = createEditorStore()
    const held = keysHeldWhilePreparing(store)
    store.state.preparation = preparation('document-reload')

    store.state.preparation = null

    expect(held()).toBe(false)
  })
})
