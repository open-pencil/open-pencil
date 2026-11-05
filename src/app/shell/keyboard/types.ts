import type { ComputedRef } from 'vue'

import type { useEditorCommands } from '@open-pencil/vue/editor/commands'
import type { OpenOverlays } from '@open-pencil/vue/lifecycle/overlays'

import type { EditorStore } from '@/app/editor/active-store'

export type KeyboardShortcutActions = {
  smartDelete: (altKey: boolean) => void
  confirmOrEditSelection: () => void
  escapeOrDeselect: () => void
  toggleAutoLayout: () => void
  toggleUI: () => void
  togglePlay: () => void
  toggleAI: () => void
  exportSelectionPNG: () => void
  opacityDigit: (digit: string) => void
}

export type KeyboardShortcutOptions = {
  inputFocused: ComputedRef<boolean>
  /** The open dialogs, menus, lists, and pickers, which hold canvas shortcuts back. */
  overlays: OpenOverlays | undefined
  store: EditorStore
  runCommand: ReturnType<typeof useEditorCommands>['runCommand']
  actions: KeyboardShortcutActions
  openFileDialog: () => void
  closeActiveTab: () => void
  createTab: () => void
  /** Opens a New file tab, as Figma's ⌘T does. */
  openNewFileTab: () => void
  switchAdjacentTab: (step: 1 | -1) => void
}

export type KeyboardShortcutRunOptions = KeyboardShortcutOptions & {
  keyEvent: KeyboardEvent
  spaceTool: { resetToolBeforeSpace: () => void }
}
