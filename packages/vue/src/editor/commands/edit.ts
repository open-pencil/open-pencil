import type { EditorCommandMapOptions } from './context'
import type { EditorCommand } from './types'

type EditCommandId = 'edit.undo' | 'edit.redo'

// Vector edit mode keeps a session-local history; undo/redo route there
// while it is active instead of the document undo stack.
export function createEditCommands({
  editor,
  capabilities,
  messages: t
}: EditorCommandMapOptions): Record<EditCommandId, EditorCommand> {
  return {
    'edit.undo': {
      id: 'edit.undo',
      get label() {
        return t.value.undo
      },
      enabled: capabilities.canUndo,
      run: () => {
        if (editor.state.nodeEditState) {
          editor.nodeEditUndo()
          return
        }
        editor.undoAction()
      }
    },
    'edit.redo': {
      id: 'edit.redo',
      get label() {
        return t.value.redo
      },
      enabled: capabilities.canRedo,
      run: () => {
        if (editor.state.nodeEditState) {
          editor.nodeEditRedo()
          return
        }
        editor.redoAction()
      }
    }
  }
}
