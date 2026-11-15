import type { KeyBinding } from '@codemirror/view'
import {
  areHotkeysEqual,
  detectPlatform,
  type HotkeyChord,
  type HotkeyPlatform,
  type RawHotkeyChord,
  type RawModifiers
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

/** CodeMirror's modifier names and their short forms, as `RawModifiers` fields. */
const CODEMIRROR_MODIFIERS = new Map<string, keyof RawModifiers>([
  ['mod', 'mod'],
  ['ctrl', 'ctrl'],
  ['control', 'ctrl'],
  ['c', 'ctrl'],
  ['alt', 'alt'],
  ['a', 'alt'],
  ['shift', 'shift'],
  ['s', 'shift'],
  ['meta', 'meta'],
  ['cmd', 'meta'],
  ['m', 'meta']
])

/**
 * A CodeMirror key name as a chord. An uppercase letter means Shift, as it does to CodeMirror,
 * which reads `Alt-A` as Alt+Shift+A.
 */
function codeMirrorChord(name: string): RawHotkeyChord {
  const parts = name.split(/-(?!$)/)
  const key = parts.pop() ?? name
  const chord: RawHotkeyChord = { key, shift: /^[A-Z]$/.test(key) }
  for (const part of parts) {
    const modifier = CODEMIRROR_MODIFIERS.get(part.toLowerCase())
    if (modifier) chord[modifier] = true
  }
  return chord
}

/** The key a binding answers on `platform`: its platform's own key where it names one. */
function bindingKey(binding: KeyBinding, platform: HotkeyPlatform): string | undefined {
  if (platform === 'mac') return binding.mac ?? binding.key
  if (platform === 'windows') return binding.win ?? binding.key
  return binding.linux ?? binding.key
}

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
    const key = bindingKey(binding, platform)
    if (!key) return true
    const chord = codeMirrorChord(key)
    return !menuShortcuts.some((shortcut) => areHotkeysEqual(chord, shortcut, platform))
  })
}
