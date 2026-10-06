import { createKeybindingsHandler, type KeyBindingMap } from 'tinykeys'

import { editorCommandMetadata, useEditorCommands, type EditorCommandId } from '@open-pencil/vue'

import { isEditing } from '@/app/shell/keyboard/focus'

const DOCUMENT_COMMANDS = ['edit.undo', 'edit.redo'] as const satisfies EditorCommandId[]

/**
 * A keydown listener for a dialog that edits the document, such as the variables dialog: undo
 * and redo run on the editor's history, as on the canvas. Only keys pressed inside the dialog
 * reach it, so a menu or picker it opens, which portals elsewhere, holds them back, and a text
 * field keeps its own undo.
 */
export function useDocumentShortcuts(): (event: KeyboardEvent) => void {
  const { runCommand } = useEditorCommands()
  const bindings: KeyBindingMap = {}
  for (const command of DOCUMENT_COMMANDS) {
    for (const keys of [editorCommandMetadata(command).keybinding ?? []].flat()) {
      bindings[keys] = (event) => {
        if (isEditing(event)) return
        event.preventDefault()
        runCommand(command)
      }
    }
  }
  const handler = createKeybindingsHandler(bindings)
  return (event) => handler(event)
}
