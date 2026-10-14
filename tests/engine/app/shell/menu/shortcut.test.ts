import { describe, expect, test } from 'bun:test'

import {
  appMenuAccelerator,
  appMenuShortcut,
  shortcutTokenToAccelerator,
  shortcutTokenToTinykeys
} from '@/app/shell/menu/shortcut'

describe('app menu shortcut conversion', () => {
  test('looks up canonical shortcut tokens from the menu schema', () => {
    expect(appMenuShortcut('export-selection')).toBe('MOD+SHIFT+E')
    expect(appMenuShortcut('selection.createComponent')).toBe('MOD+ALT+K')
  })

  test('converts shortcut tokens to tinykeys bindings', () => {
    expect(shortcutTokenToTinykeys('MOD+SHIFT+S')).toBe('$mod+Shift+S')
    expect(shortcutTokenToTinykeys('ALT+Delete')).toBe('Alt+Delete')
    expect(shortcutTokenToTinykeys('⌫')).toBe('Backspace')
  })

  test('converts shortcut tokens to native accelerators', () => {
    expect(shortcutTokenToAccelerator('MOD+SHIFT+S')).toBe('CmdOrCtrl+Shift+S')
    expect(shortcutTokenToAccelerator('ALT+A')).toBe('Alt+A')
    expect(shortcutTokenToAccelerator('⌫')).toBe('Backspace')
  })

  test('derives native accelerators from menu ids', () => {
    expect(appMenuAccelerator('export-selection')).toBe('CmdOrCtrl+Shift+E')
    expect(appMenuAccelerator('selection.delete')).toBe('Backspace')
  })
})
