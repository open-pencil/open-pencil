import { describe, expect, test } from 'bun:test'

import { appMenuShortcut, shortcutToAccelerator } from '@/app/shell/menu/shortcut'

describe('app menu shortcuts', () => {
  test('looks up shortcuts from the menu schema and editor commands', () => {
    expect(appMenuShortcut('save-as')).toBe('Mod+Shift+S')
    expect(appMenuShortcut('selection.createComponent')).toBe('Mod+Alt+K')
  })

  test('converts shortcuts to native accelerators', () => {
    expect(shortcutToAccelerator('Mod+Shift+S')).toBe('CmdOrCtrl+Shift+S')
    expect(shortcutToAccelerator('Alt+A')).toBe('Alt+A')
    expect(shortcutToAccelerator('Control+Shift+Tab')).toBe('Ctrl+Shift+Tab')
    expect(shortcutToAccelerator('Control+Meta+M')).toBe('Ctrl+Super+M')
    expect(shortcutToAccelerator('Mod+Alt+Enter')).toBe('CmdOrCtrl+Alt+Enter')
    expect(shortcutToAccelerator('Backspace')).toBe('Backspace')
    expect(shortcutToAccelerator('PageDown')).toBe('PageDown')
  })
})
