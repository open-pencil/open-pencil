import { useEventListener } from '@vueuse/core'
import type { ComputedRef } from 'vue'

import type { EditorStore } from '@/app/editor/active-store'

import { isButtonActivation } from './focus'

/**
 * While a canvas previews, Tab moves keyboard focus between its controls and the focused one
 * takes Space, Enter, arrows, Home, and End. Registered before the Space hand tool, so Space
 * pans only when no control uses it.
 */
export function bindPreviewKeys(inputFocused: ComputedRef<boolean>, store: EditorStore) {
  useEventListener(
    window,
    'keydown',
    (event: KeyboardEvent) => {
      if (!store.state.play || inputFocused.value || isButtonActivation(event)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (!store.playKey(event.key, event.shiftKey)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    },
    { capture: true }
  )
}
