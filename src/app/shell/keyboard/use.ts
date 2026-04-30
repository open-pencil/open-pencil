import { useActiveElement } from '@vueuse/core'
import { computed } from 'vue'

import { useAIChat } from '@/app/ai/chat/use'
import { useEditorStore } from '@/app/editor/active-store'
import { createKeyboardActions } from '@/app/shell/keyboard/actions'
import { bindEditorClipboard } from '@/app/shell/keyboard/clipboard'
import { isInputElement } from '@/app/shell/keyboard/focus'
import { bindNudgeKeys } from '@/app/shell/keyboard/nudging'
import { registerKeyboardShortcuts } from '@/app/shell/keyboard/registry'
import { openFileDialog } from '@/app/shell/menu/use'
import { closeTab, createTab, activeTab as activeTabRef } from '@/app/tabs'
import { useEditorCommands, useViewportKind } from '@open-pencil/vue'

export function useKeyboard() {
  const { activeTab } = useAIChat()
  const store = useEditorStore()
  const { isMobile } = useViewportKind()
  const { runCommand } = useEditorCommands()
  const activeElement = useActiveElement()
  const inputFocused = computed(() => isInputElement(activeElement.value))

  const actions = createKeyboardActions({ store, activeTab, isMobile, runCommand })

  bindEditorClipboard(store)
  bindNudgeKeys(store)

  registerKeyboardShortcuts({
    inputFocused,
    store,
    runCommand,
    actions,
    openFileDialog: () => {
      void openFileDialog()
    },
    closeActiveTab: () => {
      if (activeTabRef.value) closeTab(activeTabRef.value.id)
    },
    createTab: () => createTab()
  })
}
