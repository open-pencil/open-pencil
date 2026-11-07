import {
  ALL_KEYS,
  detectPlatform,
  formatForDisplay,
  parseHotkey,
  validateHotkey,
  type FormatDisplayOptions,
  type HotkeyChord,
  type HotkeyPlatform
} from '@tanstack/hotkeys'

/**
 * Shortcuts are written once, as TanStack Hotkeys chords such as `Mod+Shift+Z`, and every other
 * form derives from them: the label ({@link formatShortcut}), the key binding
 * (`matchesKeyboardEvent`), and a host's own forms, such as native menu accelerators or an editor
 * keymap, through {@link parseShortcut}. `Mod` is ⌘ on macOS and Ctrl elsewhere; the `HotkeyChord`
 * type rejects a misspelled modifier or key where the shortcut is written.
 */

/** Every key TanStack Hotkeys names, read as plain strings. */
const KNOWN_KEYS: ReadonlySet<string> = ALL_KEYS

/**
 * Whether a string from elsewhere, such as Core's tool keys, is a shortcut: its modifiers parse and
 * its key is one TanStack Hotkeys knows. `validateHotkey` alone lets an unknown key such as
 * `Enterr` through.
 */
export function isShortcut(value: string): value is HotkeyChord {
  if (!validateHotkey(value).valid) return false
  const { key } = parseHotkey(value)
  return key !== undefined && KNOWN_KEYS.has(key)
}

/** Labels as each platform writes them: `⇧⌘Z` on macOS, `Ctrl+Shift+Z` with key names elsewhere. */
function displayOptions(platform: HotkeyPlatform): FormatDisplayOptions {
  const mac = platform === 'mac'
  return {
    platform,
    separatorToken: mac ? '' : '+',
    useSymbols: { modifiers: true, keys: mac }
  }
}

/** A shortcut as this platform prints it: `⇧⌘Z` on macOS, `Ctrl+Shift+Z` elsewhere. */
export function formatShortcut(
  shortcut: HotkeyChord | undefined,
  platform = detectPlatform()
): string | undefined {
  return shortcut
    ? formatForDisplay(shortcut, { ...displayOptions(platform), parts: false })
    : undefined
}

/** A shortcut as this platform's key caps: `['⇧', '⌘', 'Z']` on macOS. */
export function formatShortcutKeys(shortcut: HotkeyChord, platform = detectPlatform()): string[] {
  return formatForDisplay(shortcut, { ...displayOptions(platform), parts: true })
}

/** A shortcut's modifiers with `Mod` kept apart from Control and Meta, and its key. */
export interface ParsedShortcut {
  mod: boolean
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  /** The `KeyboardEvent.key` name, as `Enter` or `Z`. */
  key: string
}

/**
 * A shortcut's parts for hosts that spell `Mod` themselves, as `CmdOrCtrl` in a native menu or
 * `Mod` in CodeMirror. Parsing resolves `Mod`, to Meta on macOS and to Control elsewhere, so a
 * modifier that differs between the two is `Mod`, and one held on both is written out.
 */
export function parseShortcut(shortcut: HotkeyChord): ParsedShortcut {
  const mac = parseHotkey(shortcut, 'mac')
  const windows = parseHotkey(shortcut, 'windows')
  return {
    mod: mac.meta && !windows.meta,
    ctrl: mac.ctrl,
    alt: mac.alt,
    shift: mac.shift,
    meta: windows.meta,
    key: mac.key ?? mac.code
  }
}
