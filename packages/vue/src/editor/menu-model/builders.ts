import type { EditorCommandId } from '#vue/editor/commands/types'
import type { useEditorCommands } from '#vue/editor/commands/use'
import {
  EDIT_MENU_COMMAND_GROUPS,
  OBJECT_MENU_COMMAND_GROUPS,
  VIEW_MENU_COMMANDS
} from '#vue/editor/menu-model/command-groups'
import type { MenuActionNode, MenuEntry, MenuSeparatorNode } from '#vue/editor/menu-model/types'
import type { useSelectionState } from '#vue/editor/selection-state/use'

type CommandMenuItem = ReturnType<typeof useEditorCommands>['menuItem']
type SelectionState = ReturnType<typeof useSelectionState>

type MenuTranslations = {
  moveToPage: string
}

type CanvasMenuOptions = {
  commandMenuItem: CommandMenuItem
  otherPages: ReturnType<typeof useEditorCommands>['otherPages']['value']
  moveSelectionToPage: ReturnType<typeof useEditorCommands>['moveSelectionToPage']
  selection: SelectionState
  t: MenuTranslations
}

function commandGroupEntries(
  commandMenuItem: CommandMenuItem,
  groups: ReadonlyArray<ReadonlyArray<EditorCommandId>>
): MenuEntry[] {
  const entries: MenuEntry[] = []
  for (const [index, group] of groups.entries()) {
    if (index > 0) entries.push({ separator: true })
    entries.push(...group.map((id) => commandMenuItem(id)))
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

export function buildCanvasMenu({
  commandMenuItem,
  otherPages,
  moveSelectionToPage,
  selection,
  t
}: CanvasMenuOptions): MenuEntry[] {
  const moveToPageSubmenu: MenuEntry[] = otherPages.map((page) => ({
    label: page.name,
    action: () => moveSelectionToPage(page.id)
  }))

  return [
    commandMenuItem('selection.duplicate'),
    commandMenuItem('selection.delete'),
    { separator: true },
    ...(moveToPageSubmenu.length > 0 && selection.hasSelection.value
      ? [{ label: t.moveToPage, sub: moveToPageSubmenu } satisfies MenuActionNode]
      : []),
    commandMenuItem('selection.bringToFront'),
    commandMenuItem('selection.sendToBack'),
    { separator: true },
    commandMenuItem('selection.group'),
    ...(selection.isGroup.value ? [commandMenuItem('selection.ungroup')] : []),
    ...(selection.hasSelection.value ? [commandMenuItem('selection.wrapInAutoLayout')] : []),
    { separator: true },
    ...(selection.isComponent.value
      ? [commandMenuItem('selection.createInstance')]
      : [commandMenuItem('selection.createComponent')]),
    ...(selection.canCreateComponentSet.value
      ? [commandMenuItem('selection.createComponentSet')]
      : []),
    ...(selection.isInstance.value ? [commandMenuItem('selection.goToMainComponent')] : []),
    ...(selection.isInstance.value ? [commandMenuItem('selection.detachInstance')] : []),
    ...(selection.hasSelection.value
      ? [
          { separator: true } as MenuSeparatorNode,
          commandMenuItem('selection.toggleVisibility'),
          commandMenuItem('selection.toggleLock')
        ]
      : [])
  ]
}
