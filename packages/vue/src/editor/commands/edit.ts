import type { EditorCommand } from './types'
import type { EditorCommandMapOptions } from './context'

type EditCommandId = 'edit.undo' | 'edit.redo'

export function createEditCommands({
  editor,
  capabilities,
  messages: t,
}: EditorCommandMapOptions): Record<EditCommandId, EditorCommand> {
  return {
    'edit.undo': {
      id: 'edit.undo',
      get label() {
        return t.value.undo
      },
      enabled: capabilities.canUndo,
      run: () => editor.undoAction(),
    },
    'edit.redo': {
      id: 'edit.redo',
      get label() {
        return t.value.redo
      },
      enabled: capabilities.canRedo,
      run: () => editor.redoAction(),
    },
  }
}
