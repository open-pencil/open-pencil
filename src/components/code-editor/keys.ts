import type { HotkeyChord } from '@tanstack/hotkeys'
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
