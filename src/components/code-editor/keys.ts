import {
  parseShortcut,
  shortcutKeyName,
  type ShortcutModifier
} from '@open-pencil/vue/editor/commands'

const CODEMIRROR_MODIFIERS: Record<ShortcutModifier, string> = {
  MOD: 'Mod',
  CTRL: 'Ctrl',
  ALT: 'Alt',
  SHIFT: 'Shift',
  META: 'Meta'
}

/** A shortcut token as a CodeMirror key: `ALT+Enter` is `Alt-Enter`, `MOD+Z` is `Mod-z`. */
export function codeMirrorKey(token: string): string {
  const { modifiers, key } = parseShortcut(token)
  const name = shortcutKeyName(key)
  return [
    ...modifiers.map((part) => CODEMIRROR_MODIFIERS[part]),
    /^[A-Z]$/.test(name) ? name.toLowerCase() : name
  ].join('-')
}
