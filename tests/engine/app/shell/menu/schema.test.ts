import { describe, expect, test } from 'bun:test'

import type { AppMenuEntry } from '@/app/shell/menu/schema'
import { APP_MENU_SCHEMA, MAIN_MENU_TRAILING_ITEMS } from '@/app/shell/menu/schema'

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
    const commandIds = actionItems(
      APP_MENU_SCHEMA.flatMap<AppMenuEntry>((group) => group.items)
    ).flatMap((entry) => {
      if ('type' in entry || !entry.command) return []
      return [entry.command]
    })

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
    const shellEntries = actionItems(
      APP_MENU_SCHEMA.flatMap<AppMenuEntry>((group) => group.items)
    ).filter((entry) => !('type' in entry) && entry.handler === 'shell')

    expect(shellEntries.map((entry) => ('type' in entry ? '' : entry.id))).toEqual([
      'theme-light',
      'theme-dark',
      'theme-auto',
      'snap-geometry',
      'snap-objects',
      'snap-pixel-grid',
      'settings',
      'view-design-issues',
      'show-welcome',
      'help-docs',
      'help-whats-new',
      'help-report-issue',
      'check-updates'
    ])
  })

  test('lists the native menu bar in Figma order, with Help last', () => {
    expect(APP_MENU_SCHEMA.map((group) => group.label)).toEqual([
      'File',
      'Edit',
      'View',
      'Object',
      'Vector',
      'Text',
      'Arrange',
      'Help'
    ])
  })

  test('keeps Preferences and Settings out of the browser File menu', () => {
    const fileMenu = APP_MENU_SCHEMA.find((group) => group.label === 'File')
    const entries = fileMenu ? actionItems(fileMenu.items) : []

    expect(entries).toContainEqual(expect.objectContaining({ id: 'preferences', target: 'native' }))
    expect(entries).toContainEqual(expect.objectContaining({ id: 'settings', target: 'native' }))
    expect(MAIN_MENU_TRAILING_ITEMS.map((entry) => entry.id)).toEqual(['preferences', 'settings'])
  })

  test('saves a local copy instead of saving, as designs save themselves', () => {
    const fileMenu = APP_MENU_SCHEMA.find((group) => group.label === 'File')
    const ids = (fileMenu ? actionItems(fileMenu.items) : []).map((entry) =>
      'type' in entry ? '' : entry.id
    )

    expect(ids).toContain('save-local-copy')
    expect(ids).not.toContain('save')
    expect(ids).not.toContain('save-as')
    expect(ids).not.toContain('autosave')
  })

  test('exposes recent files through the native File menu', () => {
    const fileMenu = APP_MENU_SCHEMA.find((group) => group.label === 'File')
    const entries = fileMenu ? actionItems(fileMenu.items) : []

    expect(entries).toContainEqual(
      expect.objectContaining({ id: 'open-recent', label: 'Open Recent', target: 'native' })
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
