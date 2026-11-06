import { describe, expect, test } from 'bun:test'

import { APP_MENU_APP_ITEMS, APP_MENU_SCHEMA } from '@/app/shell/menu/schema'
import type { AppMenuEntry } from '@/app/shell/menu/schema'
import { appMenuShortcut, shortcutTokenToAccelerator } from '@/app/shell/menu/shortcut'

function menuShortcuts(entries: readonly AppMenuEntry[]): string[] {
  return entries.flatMap((entry) =>
    entry.type === 'separator'
      ? []
      : [...(entry.shortcut ? [entry.shortcut] : []), ...menuShortcuts(entry.sub ?? [])]
  )
}

describe('app menu shortcuts', () => {
  test('looks up shortcut tokens from the menu schema and editor commands', () => {
    expect(appMenuShortcut('save-as')).toBe('MOD+SHIFT+S')
    expect(appMenuShortcut('selection.createComponent')).toBe('MOD+ALT+K')
  })

  test('converts shortcut tokens to native accelerators', () => {
    expect(shortcutTokenToAccelerator('MOD+SHIFT+S')).toBe('CmdOrCtrl+Shift+S')
    expect(shortcutTokenToAccelerator('ALT+A')).toBe('Alt+A')
    expect(shortcutTokenToAccelerator('CTRL+SHIFT+Tab')).toBe('Ctrl+Shift+Tab')
    expect(shortcutTokenToAccelerator('MOD+ALT+↩')).toBe('CmdOrCtrl+Alt+Enter')
    expect(shortcutTokenToAccelerator('⌫')).toBe('Backspace')
    expect(shortcutTokenToAccelerator('⇞')).toBe('PageUp')
    expect(shortcutTokenToAccelerator('⇟')).toBe('PageDown')
  })

  test('every menu shortcut is a valid token', () => {
    const shortcuts = [
      ...APP_MENU_SCHEMA.flatMap((group) => menuShortcuts(group.items)),
      ...menuShortcuts(APP_MENU_APP_ITEMS)
    ]
    expect(shortcuts.length).toBeGreaterThan(0)
    for (const shortcut of shortcuts)
      expect(() => shortcutTokenToAccelerator(shortcut)).not.toThrow()
  })
})
