import { describe, expect, test } from 'bun:test'

import {
  EDITOR_COMMAND_METADATA,
  editorCommandMetadata,
  editorCommandShortcuts
} from '#vue/editor/commands/registry'
import {
  formatShortcut,
  formatShortcutKeys,
  isShortcut,
  parseShortcut
} from '#vue/editor/commands/shortcut'
import type { EditorCommandId } from '#vue/editor/commands/types'

describe('formatShortcut', () => {
  test('prints symbols in macOS order on a Mac', () => {
    expect(formatShortcut('Mod+D', 'mac')).toBe('⌘D')
    expect(formatShortcut('Mod+Shift+H', 'mac')).toBe('⇧⌘H')
    expect(formatShortcut('Mod+Alt+K', 'mac')).toBe('⌥⌘K')
    expect(formatShortcut('Control+Alt+T', 'mac')).toBe('⌃⌥T')
    expect(formatShortcut('Mod+Alt+Enter', 'mac')).toBe('⌥⌘↵')
  })

  test('prints modifier and key names elsewhere', () => {
    expect(formatShortcut('Mod+Shift+H', 'windows')).toBe('Ctrl+Shift+H')
    expect(formatShortcut('Control+Shift+Tab', 'windows')).toBe('Ctrl+Shift+Tab')
    expect(formatShortcut('Mod+Alt+Enter', 'linux')).toBe('Ctrl+Alt+Enter')
    expect(formatShortcut('Control+Meta+M', 'linux')).toBe('Ctrl+Super+M')
  })

  test('splits a shortcut into key caps', () => {
    expect(formatShortcutKeys('Mod+Alt+K', 'mac')).toEqual(['⌥', '⌘', 'K'])
    expect(formatShortcutKeys('Control+Shift+Tab', 'windows')).toEqual(['Ctrl', 'Shift', 'Tab'])
  })
})

describe('parseShortcut', () => {
  test('keeps Mod apart from Control and Meta', () => {
    expect(parseShortcut('Mod+Alt+S')).toEqual({
      mod: true,
      ctrl: false,
      alt: true,
      shift: false,
      meta: false,
      key: 'S'
    })
    expect(parseShortcut('Control+Meta+M')).toMatchObject({ mod: false, ctrl: true, meta: true })
    expect(parseShortcut('Control+Tab')).toMatchObject({ mod: false, ctrl: true, key: 'Tab' })
    expect(parseShortcut('Mod+\\')).toMatchObject({ mod: true, key: '\\' })
  })
})

describe('isShortcut', () => {
  test('takes known modifiers and keys only', () => {
    expect(isShortcut('Shift+S')).toBe(true)
    expect(isShortcut('Hyper+K')).toBe(false)
    expect(isShortcut('Mod+Enterr')).toBe(false)
  })
})

describe('editor command shortcuts', () => {
  test('a command answers to its shortcut, then its aliases', () => {
    expect(editorCommandShortcuts('edit.redo')).toEqual(['Mod+Shift+Z', 'Mod+Y'])
    expect(editorCommandShortcuts('selection.wrapInSection')).toEqual([])
  })

  test('takes Figma’s keys per platform where they differ', () => {
    expect(editorCommandShortcuts('selection.distributeVertical', 'mac')).toEqual(['Control+Alt+V'])
    expect(editorCommandShortcuts('selection.distributeVertical', 'windows')).toEqual([
      'Alt+Shift+V'
    ])
    expect(editorCommandMetadata('selection.tidyUp', 'linux').shortcut).toBe('Control+Alt+Shift+T')
  })

  test('every command shortcut names known keys', () => {
    for (const id of Object.keys(EDITOR_COMMAND_METADATA) as EditorCommandId[]) {
      for (const platform of ['mac', 'windows'] as const) {
        for (const shortcut of editorCommandShortcuts(id, platform))
          expect(isShortcut(shortcut)).toBe(true)
      }
    }
  })
})
