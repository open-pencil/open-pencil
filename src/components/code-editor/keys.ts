import type { KeyBinding } from '@codemirror/view'
import {
  areHotkeysEqual,
  detectPlatform,
  type HotkeyChord,
  type HotkeyPlatform,
  parseHotkey,
  type ParsedHotkeyChord
} from '@tanstack/hotkeys'
import { compact } from 'es-toolkit'

import { parseShortcut } from '@open-pencil/vue/editor/commands'

/** A shortcut as a CodeMirror key: `Alt+Enter` is `Alt-Enter`, `Mod+Z` is `Mod-z`. */
export function codeMirrorKey(shortcut: HotkeyChord): string {
  const { mod, ctrl, alt, shift, meta, key } = parseShortcut(shortcut)
  return compact([
    mod && 'Mod',
    ctrl && 'Ctrl',
    alt && 'Alt',
    shift && 'Shift',
    meta && 'Meta',
    /^[A-Z]$/.test(key) ? key.toLowerCase() : key
  ]).join('-')
}

/**
 * A CodeMirror key as a chord: `Shift-Mod-k` is `Shift+Mod+K`. CodeMirror also reads an uppercase
 * letter as Shift (`Alt-A` is Alt+Shift+A), which TanStack does not.
 */
function codeMirrorChord(name: string, platform: HotkeyPlatform): ParsedHotkeyChord {
  const chord = name.replace(/-(?!$)/g, '+')
  return parseHotkey(/(?:^|-)[A-Z]$/.test(name) ? `Shift+${chord}` : chord, platform)
}

/** CodeMirror's `KeyBinding` field for each platform's own key. */
const PLATFORM_KEY = { mac: 'mac', windows: 'win', linux: 'linux' } as const

/**
 * `bindings` without those whose key is one of the menu's shortcuts (`appMenuShortcuts`), so an
 * editor never binds a key the native menu takes first and then does nothing with on Linux.
 */
export function withoutMenuKeys(
  bindings: readonly KeyBinding[],
  menuShortcuts: readonly HotkeyChord[],
  platform: HotkeyPlatform = detectPlatform()
): KeyBinding[] {
  return bindings.filter((binding) => {
    const key = binding[PLATFORM_KEY[platform]] ?? binding.key
    if (!key) return true
    const chord = codeMirrorChord(key, platform)
    return !menuShortcuts.some((shortcut) => areHotkeysEqual(chord, shortcut, platform))
  })
}
