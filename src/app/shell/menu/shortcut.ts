import type { HotkeyChord } from '@tanstack/hotkeys'
import { compact } from 'es-toolkit'

import {
  editorCommandMetadata,
  formatShortcut,
  parseShortcut
} from '@open-pencil/vue/editor/commands'

import type { AppMenuActionItem, AppMenuEntry } from '@/app/shell/menu/schema'
import { APP_MENU_SCHEMA } from '@/app/shell/menu/schema'

function isActionItem(entry: AppMenuEntry): entry is AppMenuActionItem {
  return !('type' in entry && entry.type === 'separator')
}

function findShortcutInEntries(
  entries: readonly AppMenuEntry[],
  id: string
): HotkeyChord | undefined {
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

export function appMenuShortcut(id: string): HotkeyChord | undefined {
  for (const group of APP_MENU_SCHEMA) {
    const shortcut = findShortcutInEntries(group.items, id)
    if (shortcut) return shortcut
  }
  return undefined
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
