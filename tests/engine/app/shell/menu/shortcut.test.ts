import { describe, expect, test } from 'bun:test'

import {
  appMenuAccelerator,
  appMenuShortcut,
  shortcutTokenToAccelerator,
  shortcutTokenToTinykeys
} from '@/app/shell/menu/shortcut'

describe('app menu shortcut conversion', () => {
  test('looks up canonical shortcut tokens from the menu schema', () => {
    expect(appMenuShortcut('save-as')).toBe('MOD+SHIFT+S')
    expect(appMenuShortcut('selection.createComponent')).toBe('MOD+ALT+K')
  })

  test('converts shortcut tokens to tinykeys bindings', () => {
    expect(shortcutTokenToTinykeys('MOD+SHIFT+S')).toBe('$mod+Shift+KeyS')
    expect(shortcutTokenToTinykeys('ALT+Delete')).toBe('Alt+Delete')
    expect(shortcutTokenToTinykeys('⌫')).toBe('Backspace')
    expect(shortcutTokenToTinykeys('CTRL+ALT+T')).toBe('Control+Alt+KeyT')
  })

  test('converts shortcut tokens to native accelerators', () => {
    expect(shortcutTokenToAccelerator('MOD+SHIFT+S')).toBe('CmdOrCtrl+Shift+S')
    expect(shortcutTokenToAccelerator('ALT+A')).toBe('Alt+A')
    expect(shortcutTokenToAccelerator('⌫')).toBe('Backspace')
    expect(shortcutTokenToAccelerator('⇞')).toBe('PageUp')
    expect(shortcutTokenToAccelerator('⇟')).toBe('PageDown')
  })

  test('derives native accelerators from menu ids', () => {
    expect(appMenuAccelerator('save-as')).toBe('CmdOrCtrl+Shift+S')
    expect(appMenuAccelerator('selection.delete')).toBe('Backspace')
    expect(appMenuAccelerator('selection.tidyUp')).toBe('Ctrl+Alt+T')
  })
})
