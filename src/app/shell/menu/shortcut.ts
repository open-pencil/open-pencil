import { detectPlatform, type HotkeyChord, type HotkeyPlatform } from '@tanstack/hotkeys'
import { compact } from 'es-toolkit'

import {
  editorCommandMetadata,
  formatShortcut,
  parseShortcut
} from '@open-pencil/vue/editor/commands'

import type { AppMenuActionItem, AppMenuEntry, AppMenuGroupSchema } from '@/app/shell/menu/schema'
import { APP_MENU_APP_ITEMS, APP_MENU_SCHEMA } from '@/app/shell/menu/schema'

function isActionItem(entry: AppMenuEntry): entry is AppMenuActionItem {
  return !('type' in entry && entry.type === 'separator')
}

/**
 * The menu's edits a focused text field carries out itself (`runFocusedCommand`), whose keys a
 * field keeps: undo and redo, select all, and the clipboard.
 */
const FIELD_EDITS = new Set([
  'edit.undo',
  'edit.redo',
  'selection.selectAll',
  'copy',
  'cut',
  'paste'
])

/** An item's shortcut on `platform`: its own, else its editor command's. */
export function appMenuItemShortcut(
  entry: AppMenuActionItem,
  platform?: HotkeyPlatform
): HotkeyChord | undefined {
  if (entry.shortcut) return entry.shortcut
  return entry.command ? editorCommandMetadata(entry.command, platform).shortcut : undefined
}

function hasCommandModifier(shortcut: HotkeyChord): boolean {
  const { mod, ctrl, alt, meta } = parseShortcut(shortcut)
  return mod || ctrl || alt || meta
}

function findShortcutInEntries(
  entries: readonly AppMenuEntry[],
  id: string
): HotkeyChord | undefined {
  for (const entry of entries) {
    if (!isActionItem(entry)) continue
    if (entry.id === id) return appMenuItemShortcut(entry)
    const shortcut = entry.sub ? findShortcutInEntries(entry.sub, id) : undefined
    if (shortcut) return shortcut
  }
  return undefined
}

export function appMenuShortcut(id: string): HotkeyChord | undefined {
  for (const group of APP_MENU_SCHEMA) {
    const shortcut = findShortcutInEntries(group.items, id)
    if (shortcut) return shortcut
  }
  return undefined
}

/**
 * The shortcuts with Ctrl, Alt, or Cmd that the items of `groups` take on `platform`, but for the
 * edits a text field does itself and items only the browser shows.
 */
export function menuShortcuts(
  groups: readonly AppMenuGroupSchema[],
  platform: HotkeyPlatform
): HotkeyChord[] {
  const shortcuts: HotkeyChord[] = []
  const walk = (entries: readonly AppMenuEntry[]) => {
    for (const entry of entries) {
      if (!isActionItem(entry) || entry.target === 'browser') continue
      const shortcut = FIELD_EDITS.has(entry.id) ? undefined : appMenuItemShortcut(entry, platform)
      if (shortcut && hasCommandModifier(shortcut)) shortcuts.push(shortcut)
      if (entry.sub) walk(entry.sub)
    }
  }
  for (const group of groups) if (group.target !== 'browser') walk(group.items)
  return shortcuts
}

/**
 * The app menu's shortcuts a text field must leave alone (`menuShortcuts`): on Linux a menu
 * item's accelerator takes its key before the page sees it, then skips its command while the
 * field has focus, so the key would do nothing there (`desktop/src/menu/mod.rs`).
 */
export function appMenuShortcuts(platform: HotkeyPlatform = detectPlatform()): HotkeyChord[] {
  return menuShortcuts([...APP_MENU_SCHEMA, { label: '', items: APP_MENU_APP_ITEMS }], platform)
}

/** A shortcut as a native menu accelerator: `Mod+Shift+S` is `CmdOrCtrl+Shift+S`. */
export function shortcutToAccelerator(shortcut: HotkeyChord | undefined): string | undefined {
  if (!shortcut) return undefined
  const { mod, ctrl, alt, shift, meta, key } = parseShortcut(shortcut)
  return compact([
    mod && 'CmdOrCtrl',
    ctrl && 'Ctrl',
    alt && 'Alt',
    shift && 'Shift',
    meta && 'Super',
    key
  ]).join('+')
}

export function appMenuShortcutLabel(id: string): string | undefined {
  return formatShortcut(appMenuShortcut(id))
}
