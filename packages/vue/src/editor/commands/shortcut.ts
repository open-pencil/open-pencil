import { compact } from 'es-toolkit/array'

/**
 * Shortcuts are written once, as tokens, and every other form derives from them: the label
 * ({@link formatShortcut}), the keyboard binding ({@link shortcutKeys}), and a host's own forms
 * (native menu accelerators, an editor keymap) through {@link parseShortcut}.
 *
 * A token is modifiers and one key joined by `+`, as `MOD+SHIFT+Z`: `MOD` is ⌘ on macOS and Ctrl
 * elsewhere, then `CTRL`, `ALT`, `SHIFT`, and `META`. The key is a letter, a digit, a punctuation
 * key (`[`, `\`, `'`), a key name (`Enter`, `Escape`, `Delete`), or a key glyph (`↵`, `⇥`, `⌫`).
 * Space separates the steps of a sequence.
 */
export type ShortcutPlatform = 'mac' | 'windows' | 'linux'

export type ShortcutModifier = 'MOD' | 'CTRL' | 'ALT' | 'SHIFT' | 'META'

export interface ParsedShortcut {
  modifiers: ShortcutModifier[]
  key: string
}

const MODIFIER_DISPLAY: Record<ShortcutPlatform, Record<ShortcutModifier, string>> = {
  mac: { MOD: '⌘', SHIFT: '⇧', ALT: '⌥', CTRL: '⌃', META: '⌘' },
  windows: { MOD: 'Ctrl', SHIFT: 'Shift', ALT: 'Alt', CTRL: 'Ctrl', META: 'Win' },
  linux: { MOD: 'Ctrl', SHIFT: 'Shift', ALT: 'Alt', CTRL: 'Ctrl', META: 'Super' }
}

const MAC_MODIFIER_ORDER: ShortcutModifier[] = ['CTRL', 'ALT', 'SHIFT', 'MOD', 'META']
const STANDARD_MODIFIER_ORDER: ShortcutModifier[] = ['MOD', 'CTRL', 'ALT', 'SHIFT', 'META']

const TINYKEYS_MODIFIERS: Record<ShortcutModifier, string> = {
  MOD: '$mod',
  CTRL: 'Control',
  ALT: 'Alt',
  SHIFT: 'Shift',
  META: 'Meta'
}

/** Key glyphs and the `KeyboardEvent.key` names they stand for. */
const KEY_GLYPHS: Readonly<Record<string, string>> = {
  '↵': 'Enter',
  '↩': 'Enter',
  '⇥': 'Tab',
  '⌫': 'Backspace',
  '⌦': 'Delete',
  '⎋': 'Escape',
  '⇞': 'PageUp',
  '⇟': 'PageDown'
}

/** Punctuation keys and their `KeyboardEvent.code`, matched by position so Shift keeps them. */
const PUNCTUATION_CODES: Readonly<Record<string, string>> = {
  '=': 'Equal',
  '-': 'Minus',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  "'": 'Quote',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  ';': 'Semicolon',
  '`': 'Backquote'
}

function isModifier(part: string): part is ShortcutModifier {
  return part in TINYKEYS_MODIFIERS
}

/** One step of a token: its modifiers and its key. */
export function parseShortcut(token: string): ParsedShortcut {
  const parts = token.split('+')
  const key = parts.at(-1) ?? ''
  const modifiers = parts.slice(0, -1)
  const unknown = modifiers.find((part) => !isModifier(part))
  if (unknown !== undefined || !key || isModifier(key)) {
    throw new Error(`Invalid shortcut token '${token}'`)
  }
  return { modifiers: modifiers.filter(isModifier), key }
}

/** The key a token's key stands for, by `KeyboardEvent.key` name: `↵` is `Enter`. */
export function shortcutKeyName(key: string): string {
  return KEY_GLYPHS[key] ?? key
}

function tinykeysKey(key: string): string {
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`
  // A digit by its character or by its key's position: the number pad types it, and AZERTY's
  // digit row needs Shift to.
  if (/^\d$/.test(key)) return `(${key}|Digit${key})`
  return PUNCTUATION_CODES[key] ?? shortcutKeyName(key)
}

/**
 * The tinykeys binding for a token, matched as the editor's keyboard matches it: a letter by the
 * letter its layout types (`shortcutCode`), punctuation by its key's position.
 */
export function shortcutKeys(token: string): string {
  return token
    .split(' ')
    .map((step) => {
      const { modifiers, key } = parseShortcut(step)
      return [...modifiers.map((part) => TINYKEYS_MODIFIERS[part]), tinykeysKey(key)].join('+')
    })
    .join(' ')
}

export function shortcutPlatform(userAgent = navigator.userAgent): ShortcutPlatform {
  if (/Mac|iPhone|iPad|iPod/u.test(userAgent)) return 'mac'
  if (/Win/u.test(userAgent)) return 'windows'
  return 'linux'
}

function sortModifiers(modifiers: ShortcutModifier[], platform: ShortcutPlatform) {
  const order = platform === 'mac' ? MAC_MODIFIER_ORDER : STANDARD_MODIFIER_ORDER
  return [...modifiers].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

/**
 * One step of a token as this platform's key caps: `['⇧', '⌘', 'Z']` on macOS,
 * `['Ctrl', 'Shift', 'Z']` elsewhere.
 */
export function formatShortcutKeys(combo: string, platform = shortcutPlatform()): string[] {
  const parts = compact(combo.split('+'))
  const modifiers = parts.filter(isModifier)
  const keys = parts.filter((part) => !isModifier(part))
  return [
    ...sortModifiers(modifiers, platform).map((part) => MODIFIER_DISPLAY[platform][part]),
    ...keys
  ]
}

/**
 * A token as this platform prints it: `⇧⌘Z` on macOS, `Ctrl+Shift+Z` elsewhere. Text that is not
 * a token, such as the opacity keys' `1-9, 0`, prints as it is.
 */
export function formatShortcut(
  shortcut: string | undefined,
  platform = shortcutPlatform()
): string | undefined {
  if (!shortcut) return undefined
  const separator = platform === 'mac' ? '' : '+'
  return shortcut
    .split(' ')
    .map((combo) => formatShortcutKeys(combo, platform).join(separator))
    .join(' ')
}
