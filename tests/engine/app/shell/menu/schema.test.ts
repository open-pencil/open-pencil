import { describe, expect, test } from 'bun:test'

import type { AppMenuEntry } from '@/app/shell/menu/schema'
import { APP_MENU_SCHEMA } from '@/app/shell/menu/schema'

function actionItems(entries: readonly AppMenuEntry[]): AppMenuEntry[] {
  const result: AppMenuEntry[] = []
  for (const entry of entries) {
    if ('type' in entry && entry.type === 'separator') continue
    result.push(entry)
    if (entry.sub) result.push(...actionItems(entry.sub))
  }
  return result
}

describe('APP_MENU_SCHEMA', () => {
  test('does not duplicate shortcuts for command-backed entries', () => {
    const duplicated = APP_MENU_SCHEMA.flatMap((group) =>
      actionItems(group.items).filter(
        (entry) => !('type' in entry) && entry.command && entry.shortcut
      )
    )

    expect(duplicated).toEqual([])
  })

  test('exposes every menu-backed editor command to shared dispatch', () => {
    const commandIds = actionItems(APP_MENU_SCHEMA.flatMap((group) => group.items)).flatMap(
      (entry) => {
        if ('type' in entry || !entry.command) return []
        return [entry.command]
      }
    )

    expect(commandIds).toContain('selection.frameSelection')
    expect(commandIds).toContain('selection.toggleMask')
    expect(commandIds).toContain('selection.toggleVisibility')
    expect(commandIds).toContain('selection.toggleLock')
    expect(commandIds).toContain('selection.flipHorizontal')
    expect(commandIds).toContain('selection.flipVertical')
    expect(commandIds).toContain('selection.createInstance')
    expect(commandIds).toContain('selection.goToMainComponent')
    expect(commandIds).toContain('selection.moveToPage')
  })

  test('marks route-neutral native actions for shell dispatch', () => {
    const shellEntries = actionItems(APP_MENU_SCHEMA.flatMap((group) => group.items)).filter(
      (entry) => !('type' in entry) && entry.handler === 'shell'
    )

    expect(shellEntries.map((entry) => ('type' in entry ? '' : entry.id))).toEqual([
      'open-storage-workspace',
      'theme-light',
      'theme-dark',
      'theme-auto',
      'settings'
    ])
  })

  test('includes storage workspace navigation in the shared File menu', () => {
    const fileMenu = APP_MENU_SCHEMA.find((group) => group.label === 'File')
    const entries = fileMenu ? actionItems(fileMenu.items) : []

    expect(entries).toContainEqual(
      expect.objectContaining({ id: 'open-storage-workspace', label: 'Open Storage Workspace…' })
    )
  })

  test('keeps move-to-page destination selection in the browser menu', () => {
    const objectMenu = APP_MENU_SCHEMA.find((group) => group.label === 'Object')
    const entries = objectMenu ? actionItems(objectMenu.items) : []
    const moveEntries = entries.filter(
      (entry) => !('type' in entry) && entry.id.startsWith('selection.moveToPage')
    )

    expect(moveEntries).toEqual([
      expect.objectContaining({ id: 'selection.moveToPage', target: 'browser' })
    ])
  })
})
