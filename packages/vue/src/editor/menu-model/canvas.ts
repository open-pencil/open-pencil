import type { EditorCommandId } from '#vue/editor/commands/types'
import type { useEditorCommands } from '#vue/editor/commands/use'
import type { MenuActionNode, MenuEntry, MenuSeparatorNode } from '#vue/editor/menu-model/types'
import type { useSelectionState } from '#vue/editor/selection-state/use'

type CommandMenuItem = ReturnType<typeof useEditorCommands>['menuItem']
type SelectionState = ReturnType<typeof useSelectionState>

type CanvasMenuCommand =
  | EditorCommandId
  | 'selection.componentAction'
  | 'selection.componentSetAction'
  | 'selection.instanceActions'
  | 'selection.ungroupWhenGroup'
  | 'selection.moveToPageWhenAvailable'

type CanvasMenuGroup = readonly CanvasMenuCommand[]

type CanvasMenuTranslations = {
  moveToPage: string
}

export type CanvasMenuOptions = {
  commandMenuItem: CommandMenuItem
  otherPages: ReturnType<typeof useEditorCommands>['otherPages']['value']
  moveSelectionToPage: ReturnType<typeof useEditorCommands>['moveSelectionToPage']
  selection: SelectionState
  t: CanvasMenuTranslations
}

const CANVAS_MENU_GROUPS = [
  ['selection.duplicate', 'selection.delete'],
  ['selection.moveToPageWhenAvailable', 'selection.bringToFront', 'selection.sendToBack'],
  [
    'selection.group',
    'selection.frameSelection',
    'selection.ungroupWhenGroup',
    'selection.wrapInAutoLayout',
    'selection.toggleMask',
    'selection.flatten',
    'selection.outlineText',
    'selection.outlineStroke'
  ],
  ['selection.componentAction', 'selection.componentSetAction', 'selection.instanceActions'],
  ['selection.toggleVisibility', 'selection.toggleLock'],
  ['selection.flipHorizontal', 'selection.flipVertical']
] satisfies readonly CanvasMenuGroup[]

function separator(): MenuSeparatorNode {
  return { separator: true }
}

function moveToPageItem({ otherPages, moveSelectionToPage, selection, t }: CanvasMenuOptions) {
  if (!selection.hasSelection.value || otherPages.length === 0) return []
  const sub = otherPages.map((page) => ({
    label: page.name,
    action: () => moveSelectionToPage(page.id)
  }))
  return [{ label: t.moveToPage, sub } satisfies MenuActionNode]
}

function componentItems({ commandMenuItem, selection }: CanvasMenuOptions): MenuEntry[] {
  return [
    selection.isComponent.value
      ? commandMenuItem('selection.createInstance')
      : commandMenuItem('selection.createComponent')
  ]
}

function componentSetItems({ commandMenuItem, selection }: CanvasMenuOptions): MenuEntry[] {
  return selection.canCreateComponentSet.value
    ? [commandMenuItem('selection.createComponentSet')]
    : []
}

function instanceItems({ commandMenuItem, selection }: CanvasMenuOptions): MenuEntry[] {
  return selection.isInstance.value
    ? [commandMenuItem('selection.goToMainComponent'), commandMenuItem('selection.detachInstance')]
    : []
}

function conditionalCommand(command: CanvasMenuCommand, options: CanvasMenuOptions): MenuEntry[] {
  switch (command) {
    case 'selection.moveToPageWhenAvailable':
      return moveToPageItem(options)
    case 'selection.componentAction':
      return componentItems(options)
    case 'selection.componentSetAction':
      return componentSetItems(options)
    case 'selection.instanceActions':
      return instanceItems(options)
    case 'selection.ungroupWhenGroup':
      return options.selection.isGroup.value ? [options.commandMenuItem('selection.ungroup')] : []
    default:
      return [options.commandMenuItem(command)]
  }
}

export function buildCanvasContextMenu(options: CanvasMenuOptions): MenuEntry[] {
  const entries: MenuEntry[] = []
  for (const group of CANVAS_MENU_GROUPS) {
    const groupEntries = group.flatMap((command) => conditionalCommand(command, options))
    if (groupEntries.length === 0) continue
    if (entries.length > 0) entries.push(separator())
    entries.push(...groupEntries)
  }
  return entries
}
