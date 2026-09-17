import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { editorCommandMetadata } from '@open-pencil/vue'

import { APP_MENU_APP_ITEMS, APP_MENU_SCHEMA } from '@/app/shell/menu/schema'
import type { AppMenuActionItem, AppMenuEntry, AppMenuGroupSchema } from '@/app/shell/menu/schema'
import { shortcutTokenToAccelerator } from '@/app/shell/menu/shortcut'

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

function renderMenu(): string {
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

export const APP_MENU_ARTIFACTS: Record<string, () => string> = {
  'desktop/generated/menu.json': renderMenu,
  'desktop/generated/app-menu.json': renderAppMenu
}

for (const [path, render] of Object.entries(APP_MENU_ARTIFACTS)) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, render())
}
