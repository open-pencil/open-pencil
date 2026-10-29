import type { ComputedRef } from 'vue'

import type { useEditorCommands } from '@open-pencil/vue/editor/commands'

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
  store: EditorStore
  runCommand: ReturnType<typeof useEditorCommands>['runCommand']
  actions: KeyboardShortcutActions
  openFileDialog: () => void
  closeActiveTab: () => void
  createTab: () => void
  showHome: () => void
  switchAdjacentTab: (step: 1 | -1) => void
}

export type KeyboardShortcutRunOptions = KeyboardShortcutOptions & {
  keyEvent: KeyboardEvent
  spaceTool: { resetToolBeforeSpace: () => void }
}
