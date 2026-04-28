import { computed, watch } from 'vue'

import type { EditorStore } from '@/app/editor/active-store'
import type { ComputedRef } from 'vue'
import type { MagicKeys } from '@/app/shell/keyboard/types'

export function bindSpaceHandTool(
  keys: MagicKeys,
  inputFocused: ComputedRef<boolean>,
  store: EditorStore
) {
  let toolBeforeSpace: typeof store.state.activeTool | null = null
  const spaceHeld = computed(
    () =>
      !inputFocused.value &&
      keys['Space'].value &&
      !keys['meta'].value &&
      !keys['control'].value &&
      !keys['alt'].value
  )

  watch(spaceHeld, (held) => {
    if (held && toolBeforeSpace === null && store.state.activeTool !== 'HAND') {
      toolBeforeSpace = store.state.activeTool
      store.setTool('HAND')
    } else if (!held && toolBeforeSpace !== null) {
      store.setTool(toolBeforeSpace)
      toolBeforeSpace = null
    }
  })

  return {
    resetToolBeforeSpace() {
      toolBeforeSpace = null
    }
  }
}
