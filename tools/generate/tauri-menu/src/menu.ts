import type { HotkeyPlatform } from '@tanstack/hotkeys'
import { compact } from 'es-toolkit/array'

import { editorCommandMetadata } from '@open-pencil/vue/editor/commands'

import { APP_MENU_APP_ITEMS, APP_MENU_SCHEMA } from '@/app/shell/menu/schema'
import type { AppMenuActionItem, AppMenuEntry, AppMenuGroupSchema } from '@/app/shell/menu/schema'
import { shortcutToAccelerator } from '@/app/shell/menu/shortcut'

export const MENU_PATH = 'desktop/generated/menu.json'
export const APP_MENU_PATH = 'desktop/generated/app-menu.json'

function isNativeVisible(entry: { target?: string }): boolean {
  return entry.target !== 'browser'
}

function entryAccelerator(
  entry: AppMenuActionItem,
  platform: HotkeyPlatform = 'windows'
): string | undefined {
  const shortcut =
    entry.shortcut ??
    (entry.command ? editorCommandMetadata(entry.command, platform).shortcut : undefined)
  return shortcutToAccelerator(shortcut)
}

/** The macOS accelerator, written only where it differs, as for Figma's distribute keys. */
function macAccelerator(entry: AppMenuActionItem): string | undefined {
  const mac = entryAccelerator(entry, 'mac')
  return mac === entryAccelerator(entry) ? undefined : mac
}

function cleanEntry(entry: AppMenuEntry): unknown | null {
  if (!isNativeVisible(entry)) return null
  if (entry.type === 'separator') return { type: 'separator' }
  return {
    id: entry.id,
    label: entry.label,
    accelerator: entryAccelerator(entry),
    macAccelerator: macAccelerator(entry),
    checkbox: entry.checkbox,
    feature: entry.feature,
    sub: entry.sub ? compact(entry.sub.map(cleanEntry)) : undefined
  }
}

function cleanGroup(group: AppMenuGroupSchema): unknown | null {
  if (!isNativeVisible(group)) return null
  return {
    label: group.label,
    feature: group.feature,
    items: compact(group.items.map(cleanEntry))
  }
}

export function renderMenu(): string {
  const menu = compact(APP_MENU_SCHEMA.map(cleanGroup))
  return `${JSON.stringify(menu, null, 2)}\n`
}

function renderAppMenu(): string {
  // Keyed by id so the native builder cannot silently drop a label.
  const items = Object.fromEntries(
    APP_MENU_APP_ITEMS.map((entry) => [
      entry.id,
      { label: entry.label, accelerator: entryAccelerator(entry) }
    ])
  )
  return `${JSON.stringify(items, null, 2)}\n`
}

/** Committed artifacts, keyed by workspace-relative path. */
export const MENU_ARTIFACTS: Record<string, () => string> = {
  [MENU_PATH]: renderMenu,
  [APP_MENU_PATH]: renderAppMenu
}
