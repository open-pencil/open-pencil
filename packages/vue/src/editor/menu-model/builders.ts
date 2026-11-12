import { appendAll } from '@open-pencil/scene-graph/arrays'

import type { EditorCommandId } from '#vue/editor/commands/types'
import type { useEditorCommands } from '#vue/editor/commands/use'
import {
  EDIT_MENU_COMMAND_GROUPS,
  OBJECT_MENU_COMMAND_GROUPS,
  VIEW_MENU_COMMANDS
} from '#vue/editor/menu-model/command-groups'
import type { MenuEntry } from '#vue/editor/menu-model/types'

type CommandMenuItem = ReturnType<typeof useEditorCommands>['menuItem']

function commandGroupEntries(
  commandMenuItem: CommandMenuItem,
  groups: ReadonlyArray<ReadonlyArray<EditorCommandId>>
): MenuEntry[] {
  const entries: MenuEntry[] = []
  for (const [index, group] of groups.entries()) {
    if (index > 0) entries.push({ separator: true })
    appendAll(
      entries,
      group.map((id) => commandMenuItem(id))
    )
  }
  return entries
}

export function buildEditMenu(commandMenuItem: CommandMenuItem): MenuEntry[] {
  return commandGroupEntries(commandMenuItem, EDIT_MENU_COMMAND_GROUPS)
}

export function buildViewMenu(commandMenuItem: CommandMenuItem): MenuEntry[] {
  return VIEW_MENU_COMMANDS.map((id) => commandMenuItem(id))
}

export function buildObjectMenu(commandMenuItem: CommandMenuItem): MenuEntry[] {
  return commandGroupEntries(commandMenuItem, OBJECT_MENU_COMMAND_GROUPS)
}
