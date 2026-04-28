import { createEditCommands } from './edit'
import { createSelectionCommands } from './selection'
import { createViewCommands } from './view'

import type { EditorCommand, EditorCommandId } from './types'
import type { EditorCommandMapOptions } from './context'

export function createEditorCommandMap(
  options: EditorCommandMapOptions
): Record<EditorCommandId, EditorCommand> {
  return {
    ...createEditCommands(options),
    ...createSelectionCommands(options),
    ...createViewCommands(options),
  }
}
