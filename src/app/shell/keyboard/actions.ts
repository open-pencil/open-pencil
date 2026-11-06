import type { Ref } from 'vue'

import type { useViewportKind } from '@open-pencil/vue/editor/viewport-kind'

import type { PropertiesTab } from '@/app/ai/chat/panel'
import type { EditorStore } from '@/app/editor/active-store'

type KeyboardActionsOptions = {
  store: EditorStore
  activeTab: Ref<PropertiesTab>
  isMobile: ReturnType<typeof useViewportKind>['isMobile']
}

/** What the app's own keys do: its panels, preview, and export. */
export function createKeyboardActions({ store, activeTab, isMobile }: KeyboardActionsOptions) {
  function toggleUI() {
    store.state.showUI = !store.state.showUI
  }

  function togglePlay() {
    store.togglePlay()
  }

  function toggleAI() {
    if (isMobile.value) {
      store.state.activeRibbonTab = store.state.activeRibbonTab === 'ai' ? 'panels' : 'ai'
      if (store.state.mobileDrawerSnap === 'closed') {
        store.state.mobileDrawerSnap = 'half'
      }
    } else {
      activeTab.value = activeTab.value === 'ai' ? 'design' : 'ai'
    }
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
