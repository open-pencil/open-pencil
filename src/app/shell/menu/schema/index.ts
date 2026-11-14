import { ARRANGE_MENU } from './arrange'
import { EDIT_MENU } from './edit'
import { FILE_MENU, SETTINGS_MENU_ITEM } from './file'
import { HELP_MENU } from './help'
import { OBJECT_MENU } from './object'
import { TEXT_MENU } from './text'
import type { AppMenuActionItem, AppMenuGroupSchema } from './types'
import { VIEW_MENU } from './view'

export type {
  AppMenuTarget,
  AppMenuIcon,
  AppMenuPaletteLabel,
  AppMenuPaletteMetadata,
  AppMenuHandler,
  AppMenuFeature,
  AppMenuActionItem,
  AppMenuSeparatorItem,
  AppMenuEntry,
  AppMenuGroupSchema
} from './types'

export const APP_MENU_SCHEMA = [
  FILE_MENU,
  EDIT_MENU,
  VIEW_MENU,
  OBJECT_MENU,
  TEXT_MENU,
  ARRANGE_MENU,
  HELP_MENU
] satisfies AppMenuGroupSchema[]

/**
 * Custom entries in the macOS application menu.
 *
 * Placement stays in Rust because the OS-predefined items (About, Services, Hide)
 * sit between them. Only the labels and shortcuts are shared here.
 */
export const APP_MENU_APP_ITEMS = [
  { id: 'about', label: 'About OpenPencil' },
  { id: 'check-updates', label: 'Check for Updates…' },
  SETTINGS_MENU_ITEM,
  { id: 'quit', label: 'Quit OpenPencil', shortcut: 'Mod+Q' }
] satisfies AppMenuActionItem[]
