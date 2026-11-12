import { useEventListener } from '@vueuse/core'
import type { ComputedRef } from 'vue'

import { resolveEditorProfile, type Editor } from '@open-pencil/core'

import { isButtonActivation } from './focus'

export function bindSpaceHandTool(
  inputFocused: ComputedRef<boolean>,
  store: Editor,
  active: () => boolean = () => true
) {
  let toolBeforeSpace: typeof store.state.activeTool | null = null

  function restoreTool() {
    if (toolBeforeSpace === null) return
    store.setTool(toolBeforeSpace, { held: true })
    toolBeforeSpace = null
  }

  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.code !== 'Space' || isButtonActivation(event)) return
    if (!active() || inputFocused.value || store.state.editingTextId) return
    // A preview's controls take Space themselves, as a switch or a checkbox does.
    if (resolveEditorProfile(store.state).shortcuts === 'view') return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    if (toolBeforeSpace !== null || store.state.activeTool === 'HAND') return
    toolBeforeSpace = store.state.activeTool
    // Held: the pen's path continues once Space is let go, as in Figma.
    store.setTool('HAND', { held: true })
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
