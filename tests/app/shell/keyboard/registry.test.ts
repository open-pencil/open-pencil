import { describe, expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session'
import { appShortcuts } from '@/app/shell/keyboard/registry'

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
