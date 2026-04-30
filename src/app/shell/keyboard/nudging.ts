import { useEventListener } from '@vueuse/core'

import { isEditing } from '@/app/shell/keyboard/focus'
import { isReservedModShortcut } from '@/app/shell/keyboard/reserved'

import type { EditorStore } from '@/app/editor/active-store'

const NUDGE_DELTAS: Partial<Record<string, [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0]
}

export function bindNudgeKeys(store: EditorStore) {
  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (isEditing(e) || store.state.editingTextId) return
    if (isReservedModShortcut(e)) e.preventDefault()
    if (e.metaKey || e.ctrlKey || e.altKey) return

    const delta = NUDGE_DELTAS[e.code]
    if (!delta || store.state.selectedIds.size === 0) return

    const step = e.shiftKey ? 10 : 1
    store.nudgeSelected(delta[0] * step, delta[1] * step)
    e.preventDefault()
  })
}
