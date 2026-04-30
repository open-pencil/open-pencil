import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { APP_MENU_SCHEMA } from '../src/app/shell/menu/schema'

import type { AppMenuEntry, AppMenuGroupSchema } from '../src/app/shell/menu/schema'

function isNativeVisible(entry: { target?: string }): boolean {
  return entry.target !== 'browser'
}

function cleanEntry(entry: AppMenuEntry): unknown | null {
  if (!isNativeVisible(entry)) return null
  if (entry.type === 'separator') return { type: 'separator' }
  return {
    id: entry.id,
    label: entry.label,
    accelerator: entry.accelerator,
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

const outputPath = 'desktop/generated/menu.json'
const menu = APP_MENU_SCHEMA.map(cleanGroup).filter(Boolean)
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(menu, null, 2)}\n`)
