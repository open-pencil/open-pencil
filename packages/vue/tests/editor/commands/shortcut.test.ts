import { describe, expect, test } from 'bun:test'

import { formatShortcut, shortcutPlatform } from '#vue/editor/commands/shortcut'

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

  test('detects platform from user agent', () => {
    expect(shortcutPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('mac')
    expect(shortcutPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows')
    expect(shortcutPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux')
  })
})
