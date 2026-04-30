import { isEditing } from '@/app/shell/keyboard/focus'
import { preventReservedKeyboardDefaults } from '@/app/shell/keyboard/reserved'

import type { EditorStore } from '@/app/editor/active-store'

export function handleMagicKeyEvent(e: KeyboardEvent, store: EditorStore) {
  if (e.type !== 'keydown') return
  if (isEditing(e) || store.state.editingTextId) return

  preventReservedKeyboardDefaults(e)
  if ((e.metaKey || e.ctrlKey) && !e.altKey) {
    if (e.code === 'KeyZ') {
      if (e.shiftKey) store.redoAction()
      else store.undoAction()
      e.preventDefault()
      return
    }
    if (e.code === 'KeyY') {
      store.redoAction()
      e.preventDefault()
      return
    }
  }
  if (e.code === 'Enter' && store.state.penState) e.preventDefault()
}
