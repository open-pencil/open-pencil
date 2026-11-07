import { matchesKeyboardEvent } from '@tanstack/hotkeys'

import {
  editorCommandShortcuts,
  useEditorCommands,
  type EditorCommandId
} from '#vue/editor/commands'

import { isEditing } from './focus'

const DOCUMENT_COMMANDS = ['edit.undo', 'edit.redo'] as const satisfies EditorCommandId[]

/**
 * A keydown listener for a dialog that edits the document, such as the variables dialog: undo
 * and redo run on the editor's history, as on the canvas. Only keys pressed inside the dialog
 * reach it, so a menu or picker it opens, which portals elsewhere, holds them back, and a text
 * field keeps its own undo.
 */
export function useDocumentShortcuts(): (event: KeyboardEvent) => void {
  const { runCommand } = useEditorCommands()
  return (event) => {
    if (isEditing(event)) return
    const command = DOCUMENT_COMMANDS.find((id) =>
      editorCommandShortcuts(id).some((shortcut) => matchesKeyboardEvent(event, shortcut))
    )
    if (!command) return
    event.preventDefault()
    runCommand(command)
  }
}
