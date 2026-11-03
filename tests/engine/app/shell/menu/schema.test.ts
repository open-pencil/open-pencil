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
      'open-tour',
      'diagnostics',
      'report-problem',
      'support-openpencil',
      'settings',
      'view-design-issues',
      'theme-light',
      'theme-dark',
      'theme-auto',
      'snap-geometry',
      'snap-objects',
      'snap-pixel-grid'
    ])
  })

  // As in Figma, files are browsed on Home and in a New tab, so the File menu creates and saves.
  test('starts documents and saves to places from the File menu', () => {
    const fileMenu = APP_MENU_SCHEMA.find((group) => group.label === 'File')
    const ids = (fileMenu ? actionItems(fileMenu.items) : []).map((entry) =>
      'type' in entry ? '' : entry.id
    )

    expect(ids.slice(0, 3)).toEqual(['new', 'new-tab', 'open'])
    expect(ids).not.toContain('browse-files')
    expect(ids).toContain('save-to')
    expect(ids).not.toContain('save-to-cloud')
  })

  test('exposes recent files through the native File menu', () => {
    const fileMenu = APP_MENU_SCHEMA.find((group) => group.label === 'File')
    const entries = fileMenu ? actionItems(fileMenu.items) : []

    expect(entries).toContainEqual(
      expect.objectContaining({ id: 'open-recent', label: 'Open Recent', target: 'native' })
    )
  })

  // Home and a New file tab hold no document: the menus keep what starts, opens, and switches
  // documents, and the app's own settings, and leave out what edits or shows one.
  test('shows only document-free menus and items while no document is in front', () => {
    const shownIds = (items: readonly AppMenuEntry[]) =>
      items.flatMap((entry) =>
        entry.type === 'separator' || entry.feature === 'document' ? [] : [entry.id]
      )
    const shown = new Map(
      APP_MENU_SCHEMA.filter((group) => group.feature !== 'document').map((group) => [
        group.label,
        shownIds(group.items)
      ])
    )

    expect([...shown.keys()]).toEqual(['File', 'Edit', 'View'])
    expect(shown.get('File')).toEqual(expect.arrayContaining(['new', 'open', 'settings']))
    expect(shown.get('Edit')).toEqual(expect.arrayContaining(['copy', 'cut', 'paste']))
    const shownAnywhere = [...shown.values()].flat()
    for (const id of [
      'save',
      'export-selection',
      'edit.undo',
      'selection.selectAll',
      'view.zoomFit'
    ]) {
      expect(shownAnywhere).not.toContain(id)
    }
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
