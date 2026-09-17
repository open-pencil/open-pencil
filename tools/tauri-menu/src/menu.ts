import { editorCommandMetadata } from '@open-pencil/vue'

import { APP_MENU_APP_ITEMS, APP_MENU_SCHEMA } from '@/app/shell/menu/schema'
import type { AppMenuActionItem, AppMenuEntry, AppMenuGroupSchema } from '@/app/shell/menu/schema'
import { shortcutTokenToAccelerator } from '@/app/shell/menu/shortcut'

export const MENU_PATH = 'desktop/generated/menu.json'
export const APP_MENU_PATH = 'desktop/generated/app-menu.json'

function isNativeVisible(entry: { target?: string }): boolean {
  return entry.target !== 'browser'
}

function entryAccelerator(entry: AppMenuActionItem): string | undefined {
  const shortcut =
    entry.shortcut ?? (entry.command ? editorCommandMetadata(entry.command).shortcut : undefined)
  return entry.accelerator ?? shortcutTokenToAccelerator(shortcut)
}

function cleanEntry(entry: AppMenuEntry): unknown | null {
  if (!isNativeVisible(entry)) return null
  if (entry.type === 'separator') return { type: 'separator' }
  return {
    id: entry.id,
    label: entry.label,
    accelerator: entryAccelerator(entry),
    checkbox: entry.checkbox,
    sub: entry.sub?.map(cleanEntry).filter(Boolean)
  }
}

function cleanGroup(group: AppMenuGroupSchema): unknown | null {
  if (!isNativeVisible(group)) return null
  return {
    label: group.label,
    items: group.items.map(cleanEntry).filter(Boolean)
  }
}

export function renderMenu(): string {
  const menu = APP_MENU_SCHEMA.map(cleanGroup).filter(Boolean)
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
