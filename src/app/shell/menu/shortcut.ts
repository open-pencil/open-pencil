import {
  editorCommandMetadata,
  formatShortcut,
  parseShortcut,
  shortcutKeyName,
  type ShortcutModifier
} from '@open-pencil/vue/editor/commands'

import type { AppMenuActionItem, AppMenuEntry } from '@/app/shell/menu/schema'
import { APP_MENU_SCHEMA } from '@/app/shell/menu/schema'

function isActionItem(entry: AppMenuEntry): entry is AppMenuActionItem {
  return !('type' in entry && entry.type === 'separator')
}

function findShortcutInEntries(entries: readonly AppMenuEntry[], id: string): string | undefined {
  for (const entry of entries) {
    if (!isActionItem(entry)) continue
    if (entry.id === id)
      return (
        entry.shortcut ??
        (entry.command ? editorCommandMetadata(entry.command).shortcut : undefined)
      )
    const shortcut = entry.sub ? findShortcutInEntries(entry.sub, id) : undefined
    if (shortcut) return shortcut
  }
  return undefined
}

export function appMenuShortcut(id: string): string | undefined {
  for (const group of APP_MENU_SCHEMA) {
    const shortcut = findShortcutInEntries(group.items, id)
    if (shortcut) return shortcut
  }
  return undefined
}

const ACCELERATOR_MODIFIERS: Record<ShortcutModifier, string> = {
  MOD: 'CmdOrCtrl',
  CTRL: 'Ctrl',
  ALT: 'Alt',
  SHIFT: 'Shift',
  META: 'Super'
}

/** A shortcut token as a native menu accelerator: `MOD+SHIFT+S` is `CmdOrCtrl+Shift+S`. */
export function shortcutTokenToAccelerator(shortcut: string | undefined): string | undefined {
  if (!shortcut) return undefined
  const { modifiers, key } = parseShortcut(shortcut)
  return [...modifiers.map((part) => ACCELERATOR_MODIFIERS[part]), shortcutKeyName(key)].join('+')
}

export function appMenuShortcutLabel(id: string): string | undefined {
  return formatShortcut(appMenuShortcut(id))
}
