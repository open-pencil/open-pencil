import { EDITOR_COMMAND_SHORTCUTS } from './metadata'

import type { EditorCommand, EditorCommandId, EditorCommandMenuItem } from './types'

export function createEditorCommandActions(commands: Record<EditorCommandId, EditorCommand>) {
  function getCommand(id: EditorCommandId) {
    return commands[id]
  }

  function runCommand(id: EditorCommandId) {
    const command = commands[id]
    if (command.enabled.value) command.run()
  }

  function menuItem(
    id: EditorCommandId,
    shortcut = EDITOR_COMMAND_SHORTCUTS[id]
  ): EditorCommandMenuItem {
    const command = getCommand(id)
    return {
      id,
      label: command.label,
      shortcut,
      get disabled() {
        return !command.enabled.value
      },
      action: () => runCommand(id)
    }
  }

  return { getCommand, runCommand, menuItem }
}
