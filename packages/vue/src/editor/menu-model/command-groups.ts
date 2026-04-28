import type { EditorCommandId } from '#vue/editor/commands/types'

export const EDIT_MENU_COMMAND_GROUPS = [
  ['edit.undo', 'edit.redo'],
  ['selection.duplicate', 'selection.delete'],
  ['selection.selectAll'],
] satisfies ReadonlyArray<ReadonlyArray<EditorCommandId>>

export const VIEW_MENU_COMMANDS = [
  'view.zoom100',
  'view.zoomFit',
  'view.zoomSelection',
] satisfies ReadonlyArray<EditorCommandId>

export const OBJECT_MENU_COMMAND_GROUPS = [
  ['selection.group', 'selection.ungroup'],
  ['selection.createComponent', 'selection.createComponentSet', 'selection.detachInstance'],
  ['selection.bringToFront', 'selection.sendToBack'],
] satisfies ReadonlyArray<ReadonlyArray<EditorCommandId>>
