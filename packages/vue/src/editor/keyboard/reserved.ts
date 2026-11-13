import { matchesKeyboardEvent, type HotkeyChord } from '@tanstack/hotkeys'

const RESERVED_MOD_KEYS = [
  '\\',
  '[',
  ']',
  '0',
  '1',
  '2',
  'A',
  'B',
  'D',
  'E',
  'G',
  'H',
  'J',
  'K',
  'L',
  'N',
  'O',
  'S',
  'T',
  'W',
  'Y',
  'Z'
] as const

/**
 * The editor's Mod keys, with and without Shift, and Mod+Alt+B and Mod+Alt+K: the browser's own
 * actions for them (bookmarks, history, a new window) stay stopped even where the editor's key
 * does nothing, as in a preview.
 */
const RESERVED_MOD_SHORTCUTS: readonly HotkeyChord[] = [
  ...RESERVED_MOD_KEYS.flatMap((key) => [`Mod+${key}`, `Mod+Shift+${key}`] as const),
  'Mod+Alt+B',
  'Mod+Alt+K'
]

export function isReservedModShortcut(event: KeyboardEvent): boolean {
  return RESERVED_MOD_SHORTCUTS.some((shortcut) => matchesKeyboardEvent(event, shortcut))
}
