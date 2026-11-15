import { describe, expect, test } from 'bun:test'

import type { KeyBinding } from '@codemirror/view'

import { appMenuShortcut, appMenuShortcuts, shortcutToAccelerator } from '@/app/shell/menu/shortcut'
import { withoutMenuKeys } from '@/components/code-editor/keys'

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

describe('menu keys in text fields', () => {
  test('lists the menu keys a field must leave alone, but for its own edits', () => {
    const shortcuts = appMenuShortcuts('linux')
    expect(shortcuts).toContain('Mod+]')
    expect(shortcuts).toContain('Mod+Shift+K')
    expect(shortcuts).toContain('Mod+I')
    for (const edit of ['Mod+Z', 'Mod+Shift+Z', 'Mod+A', 'Mod+C', 'Mod+X', 'Mod+V'])
      expect(shortcuts).not.toContain(edit)
  })

  test('leaves out keys without Ctrl, Alt, or Cmd', () => {
    expect(
      appMenuShortcuts('linux').every((shortcut) => /Mod|Control|Alt|Meta/.test(shortcut))
    ).toBe(true)
  })

  test('drops editor bindings whose key the menu takes', () => {
    const run = () => true
    const bindings: KeyBinding[] = [
      { key: 'Mod-]', run },
      { key: 'Shift-Mod-k', run },
      { key: 'Mod-Shift-K', run },
      { key: 'Mod-z', run },
      { key: 'Tab', run },
      { key: 'Alt-ArrowUp', run },
      { mac: 'Cmd-]', run }
    ]
    const keys = (platform: 'mac' | 'linux') =>
      withoutMenuKeys(bindings, ['Mod+]', 'Mod+Shift+K'], platform).map(
        (binding) => binding.key ?? binding.mac
      )
    expect(keys('linux')).toEqual(['Mod-z', 'Tab', 'Alt-ArrowUp', 'Cmd-]'])
    expect(keys('mac')).toEqual(['Mod-z', 'Tab', 'Alt-ArrowUp'])
  })

  test('keeps a Ctrl binding where the menu takes Cmd', () => {
    const run = () => true
    expect(withoutMenuKeys([{ key: 'Ctrl-]', run }], ['Mod+]'], 'mac')).toHaveLength(1)
    expect(withoutMenuKeys([{ key: 'Ctrl-]', run }], ['Mod+]'], 'windows')).toHaveLength(0)
  })
})
