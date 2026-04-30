import { useEventListener } from '@vueuse/core'

import type { EditorStore } from '@/app/editor/active-store'
import type { ComputedRef } from 'vue'

export function bindSpaceHandTool(inputFocused: ComputedRef<boolean>, store: EditorStore) {
  let toolBeforeSpace: typeof store.state.activeTool | null = null

  function restoreTool() {
    if (toolBeforeSpace === null) return
    store.setTool(toolBeforeSpace)
    toolBeforeSpace = null
  }

  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.code !== 'Space') return
    if (inputFocused.value || store.state.editingTextId) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    if (toolBeforeSpace !== null || store.state.activeTool === 'HAND') return
    toolBeforeSpace = store.state.activeTool
    store.setTool('HAND')
  })

  useEventListener(window, 'keyup', (event: KeyboardEvent) => {
    if (event.code === 'Space') restoreTool()
  })

  useEventListener(window, 'blur', restoreTool)

  return {
    resetToolBeforeSpace() {
      toolBeforeSpace = null
    }
  }
}
