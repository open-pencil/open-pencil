import { redo, undo } from '@codemirror/commands'
import { Prec, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { matchesKeyboardEvent } from '@tanstack/hotkeys'

import { editorCommandShortcuts } from '@open-pencil/vue/editor/commands'

/**
 * Undo and redo in a CodeMirror field on the app's own shortcuts for them, ahead of everything
 * else, and kept from the page: the document's undo, the app's key handlers, and the desktop
 * menu's accelerators never see a key the field has taken. Needs `history()`.
 */
export function appHistoryKeys(): Extension {
  return Prec.highest(
    EditorView.domEventHandlers({
      keydown(event, editor) {
        if (event.isComposing) return false
        const pressed = (id: 'edit.undo' | 'edit.redo') =>
          editorCommandShortcuts(id).some((shortcut) => matchesKeyboardEvent(event, shortcut))
        const redoing = pressed('edit.redo')
        if (!redoing && !pressed('edit.undo')) return false
        event.preventDefault()
        event.stopPropagation()
        if (redoing) redo(editor)
        else undo(editor)
        return true
      }
    })
  )
}
