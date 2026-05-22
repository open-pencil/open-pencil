import { editorCommandMetadata, formatShortcut } from '@open-pencil/vue'

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

function normalizeShortcutToken(shortcut: string): string {
  return shortcut === '⌫' ? 'Backspace' : shortcut
}

export function shortcutTokenToTinykeys(shortcut: string | undefined): string | undefined {
  return shortcut
    ? normalizeShortcutToken(shortcut)
        .replaceAll('MOD', '$mod')
        .replaceAll('SHIFT', 'Shift')
        .replaceAll('ALT', 'Alt')
    : undefined
}

export function shortcutTokenToAccelerator(shortcut: string | undefined): string | undefined {
  return shortcut
    ? normalizeShortcutToken(shortcut)
        .replaceAll('MOD', 'CmdOrCtrl')
        .replaceAll('SHIFT', 'Shift')
        .replaceAll('ALT', 'Alt')
    : undefined
}

export function appMenuShortcutLabel(id: string): string | undefined {
  return formatShortcut(appMenuShortcut(id))
}

export function appMenuTinykeysShortcut(id: string): string | undefined {
  return shortcutTokenToTinykeys(appMenuShortcut(id))
}

export function appMenuAccelerator(id: string): string | undefined {
  return shortcutTokenToAccelerator(appMenuShortcut(id))
}
