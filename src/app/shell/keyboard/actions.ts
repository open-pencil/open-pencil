import type { useViewportKind } from '@open-pencil/vue/editor/viewport-kind'

import { toggleChatPanel } from '@/app/ai/chat/panel'
import type { EditorStore } from '@/app/editor/active-store'

type KeyboardActionsOptions = {
  store: EditorStore
  isMobile: ReturnType<typeof useViewportKind>['isMobile']
}

/** What the app's own keys do: its panels, preview, and export. */
export function createKeyboardActions({ store, isMobile }: KeyboardActionsOptions) {
  function toggleUI() {
    store.state.showUI = !store.state.showUI
  }

  function togglePlay() {
    store.togglePlay()
  }

  function toggleAI() {
    toggleChatPanel(store, isMobile.value)
  }

  function exportSelectionPNG() {
    if (store.state.selectedIds.size > 0) void store.exportSelection(1, 'png')
  }

  return {
    toggleUI,
    togglePlay,
    toggleAI,
    exportSelectionPNG
  }
}
