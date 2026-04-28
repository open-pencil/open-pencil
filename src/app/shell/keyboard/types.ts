import type { EditorStore } from '@/app/editor/active-store'
import type { useEditorCommands } from '@open-pencil/vue'
import type { ComputedRef } from 'vue'

export type MagicKeys = Record<string, { value: boolean }>

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
  keys: MagicKeys
  inputFocused: ComputedRef<boolean>
  store: EditorStore
  runCommand: ReturnType<typeof useEditorCommands>['runCommand']
  actions: KeyboardShortcutActions
  openFileDialog: () => void
  closeActiveTab: () => void
  createTab: () => void
}
