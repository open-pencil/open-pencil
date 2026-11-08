import type { EditorStore } from '@/app/editor/active-store'

/** What the app's own keys do, beside the editor's. */
export type KeyboardShortcutActions = {
  toggleUI: () => void
  togglePlay: () => void
  toggleAI: () => void
  exportSelectionPNG: () => void
}

export type KeyboardShortcutOptions = {
  store: EditorStore
  actions: KeyboardShortcutActions
  openFileDialog: () => void
  closeActiveTab: () => void
  createTab: () => void
  /** Opens a New file tab, as Figma's ⌘T does. */
  openNewFileTab: () => void
  switchAdjacentTab: (step: 1 | -1) => void
}
