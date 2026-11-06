import { describe, expect, test } from 'bun:test'

import { EDITOR_COMMAND_METADATA, editorCommandShortcuts } from '#vue/editor/commands/registry'
import {
  formatShortcut,
  formatShortcutKeys,
  parseShortcut,
  shortcutKeys,
  shortcutPlatform
} from '#vue/editor/commands/shortcut'
import type { EditorCommandId } from '#vue/editor/commands/types'

describe('formatShortcut', () => {
  test('formats shortcuts for macOS', () => {
    expect(formatShortcut('MOD+D', 'mac')).toBe('⌘D')
    expect(formatShortcut('MOD+SHIFT+H', 'mac')).toBe('⇧⌘H')
    expect(formatShortcut('MOD+ALT+K', 'mac')).toBe('⌥⌘K')
    expect(formatShortcut('SHIFT+A', 'mac')).toBe('⇧A')
  })

  test('formats shortcuts for Windows and Linux', () => {
    expect(formatShortcut('MOD+D', 'windows')).toBe('Ctrl+D')
    expect(formatShortcut('MOD+SHIFT+H', 'windows')).toBe('Ctrl+Shift+H')
    expect(formatShortcut('MOD+ALT+K', 'linux')).toBe('Ctrl+Alt+K')
    expect(formatShortcut('SHIFT+A', 'linux')).toBe('Shift+A')
  })

  test('splits a shortcut into key caps in platform order', () => {
    expect(formatShortcutKeys('MOD+ALT+K', 'mac')).toEqual(['⌥', '⌘', 'K'])
    expect(formatShortcutKeys('CTRL+ALT+T', 'mac')).toEqual(['⌃', '⌥', 'T'])
    expect(formatShortcutKeys('CTRL+SHIFT+Tab', 'windows')).toEqual(['Ctrl', 'Shift', 'Tab'])
  })

  test('detects platform from user agent', () => {
    expect(shortcutPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('mac')
    expect(shortcutPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows')
    expect(shortcutPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux')
  })
})

describe('shortcutKeys', () => {
  test('binds letters by layout letter and punctuation by key position', () => {
    expect(shortcutKeys('MOD+SHIFT+S')).toBe('$mod+Shift+KeyS')
    expect(shortcutKeys('CTRL+ALT+T')).toBe('Control+Alt+KeyT')
    expect(shortcutKeys("SHIFT+'")).toBe('Shift+Quote')
    expect(shortcutKeys('MOD+\\')).toBe('$mod+Backslash')
    expect(shortcutKeys('MOD+=')).toBe('$mod+Equal')
    expect(shortcutKeys('-')).toBe('Minus')
  })

  test('binds key names and glyphs by name', () => {
    expect(shortcutKeys('ALT+Delete')).toBe('Alt+Delete')
    expect(shortcutKeys('⌫')).toBe('Backspace')
    expect(shortcutKeys('MOD+ALT+↩')).toBe('$mod+Alt+Enter')
    expect(shortcutKeys('SHIFT+⇥')).toBe('Shift+Tab')
    expect(shortcutKeys('⇟')).toBe('PageDown')
  })

  test('binds a digit by its character or its key position', () => {
    expect(shortcutKeys('5')).toBe('(5|Digit5)')
    expect(shortcutKeys('SHIFT+1')).toBe('Shift+(1|Digit1)')
  })

  test('rejects tokens that are not modifiers and one key', () => {
    expect(() => parseShortcut('HYPER+K')).toThrow()
    expect(() => parseShortcut('MOD+')).toThrow()
    expect(() => parseShortcut('SHIFT')).toThrow()
  })
})

describe('editor command shortcuts', () => {
  test('a command answers to its shortcut, then its aliases', () => {
    expect(editorCommandShortcuts('edit.redo')).toEqual(['MOD+SHIFT+Z', 'MOD+Y'])
    expect(editorCommandShortcuts('selection.wrapInSection')).toEqual([])
  })

  test('every bindable command shortcut is a valid token', () => {
    // The opacity digits' shortcut only describes a range of keys for menus.
    const ids = Object.keys(EDITOR_COMMAND_METADATA).filter(
      (id): id is EditorCommandId => id !== 'selection.setOpacity'
    )
    for (const id of ids) {
      for (const token of editorCommandShortcuts(id))
        expect(() => shortcutKeys(token)).not.toThrow()
    }
  })
})
