import { useEventListener } from '@vueuse/core'
import type { ComputedRef } from 'vue'

import type { EditorStore } from '@/app/editor/active-store'

import { isButtonActivation } from './focus'

/**
 * While a canvas previews, Tab moves keyboard focus between its controls and the focused one
 * takes the keys it uses: Space, Enter, arrows, Home, and End, or typing in a text field.
 * Registered before the Space hand tool and the editor's shortcuts, so Space pans and letters
 * stay inert only when no control uses them.
 */
export function bindPreviewKeys(inputFocused: ComputedRef<boolean>, store: EditorStore) {
  useEventListener(
    window,
    'keydown',
    (event: KeyboardEvent) => {
      if (!store.state.play || inputFocused.value || isButtonActivation(event)) return
      // Option types characters such as @ on some layouts, so only Cmd and Ctrl mean shortcuts.
      if (event.metaKey || event.ctrlKey) return
      if (!store.playKey(event.key, event.shiftKey)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    },
    { capture: true }
  )
}
