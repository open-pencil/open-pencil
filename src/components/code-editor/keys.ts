import type { KeyBinding } from '@codemirror/view'
import { detectPlatform, type HotkeyChord, type HotkeyPlatform } from '@tanstack/hotkeys'
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
 * A CodeMirror key name as CodeMirror resolves it on `platform`, for comparing two names:
 * modifiers in one order, `Mod` as Cmd on macOS and Ctrl elsewhere, and letters lowercase.
 */
function resolvedKey(name: string, platform: HotkeyPlatform): string {
  const parts = name.split(/-(?!$)/)
  const key = parts.at(-1) ?? name
  const modifiers = new Set(
    parts.slice(0, -1).map((part) => {
      const modifier = part.toLowerCase()
      if (modifier === 'mod') return platform === 'mac' ? 'meta' : 'ctrl'
      if (modifier === 'cmd' || modifier === 'm') return 'meta'
      if (modifier === 'control' || modifier === 'c') return 'ctrl'
      if (modifier === 'a') return 'alt'
      if (modifier === 's') return 'shift'
      return modifier
    })
  )
  const order = ['alt', 'ctrl', 'meta', 'shift'].filter((modifier) => modifiers.has(modifier))
  return [...order, key.length === 1 ? key.toLowerCase() : key].join('-')
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
  const taken = new Set(
    menuShortcuts.map((shortcut) => resolvedKey(codeMirrorKey(shortcut), platform))
  )
  return bindings.filter((binding) => {
    const key = bindingKey(binding, platform)
    return !key || !taken.has(resolvedKey(key, platform))
  })
}
