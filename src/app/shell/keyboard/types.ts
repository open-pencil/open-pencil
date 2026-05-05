import type { ComputedRef } from 'vue'

import type { useEditorCommands } from '@open-pencil/vue'

import type { EditorStore } from '@/app/editor/active-store'

export type KeyboardShortcutActions = {
  smartDelete: (altKey: boolean) => void
  confirmOrEnterText: () => void
  escapeOrDeselect: () => void
  toggleAutoLayout: () => void
  toggleUI: () => void
  toggleAI: () => void
  exportSelectionPng: () => void
}

export type KeyboardShortcutOptions = {
  inputFocused: ComputedRef<boolean>
  store: EditorStore
  runCommand: ReturnType<typeof useEditorCommands>['runCommand']
  actions: KeyboardShortcutActions
  openFileDialog: () => void
  closeActiveTab: () => void
  createTab: () => void
}

export type KeyboardShortcutRunOptions = KeyboardShortcutOptions & {
  keyEvent: KeyboardEvent
  spaceTool: { resetToolBeforeSpace: () => void }
}
