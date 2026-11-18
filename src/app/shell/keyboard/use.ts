import { useViewportKind } from '@open-pencil/vue/editor/viewport-kind'

import { useEditorStore } from '@/app/editor/active-store'
import { createKeyboardActions } from '@/app/shell/keyboard/actions'
import { bindEditorClipboard } from '@/app/shell/keyboard/clipboard'
import { registerKeyboardShortcuts } from '@/app/shell/keyboard/registry'
import { openFileDialog } from '@/app/shell/menu/use'
import {
  closeTab,
  openNewFileTab,
  createTab,
  switchAdjacentTab,
  activeTab as activeTabRef
} from '@/app/tabs'

export function useKeyboard() {
  const store = useEditorStore()
  const { isMobile } = useViewportKind()
  const actions = createKeyboardActions({ store, isMobile })

  bindEditorClipboard(store)

  registerKeyboardShortcuts({
    store,
    actions,
    openFileDialog: () => {
      void openFileDialog()
    },
    closeActiveTab: () => {
      if (activeTabRef.value) void closeTab(activeTabRef.value.id)
    },
    createTab: () => createTab(),
    openNewFileTab: () => openNewFileTab(),
    switchAdjacentTab
  })
}
