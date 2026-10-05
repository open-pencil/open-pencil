import { compact } from 'es-toolkit/array'
export type ShortcutPlatform = 'mac' | 'windows' | 'linux'

const MODIFIER_DISPLAY: Record<ShortcutPlatform, Record<string, string>> = {
  mac: {
    MOD: '⌘',
    SHIFT: '⇧',
    ALT: '⌥',
    CTRL: '⌃'
  },
  windows: {
    MOD: 'Ctrl',
    SHIFT: 'Shift',
    ALT: 'Alt',
    CTRL: 'Ctrl'
  },
  linux: {
    MOD: 'Ctrl',
    SHIFT: 'Shift',
    ALT: 'Alt',
    CTRL: 'Ctrl'
  }
}

const MAC_MODIFIER_ORDER = ['CTRL', 'ALT', 'SHIFT', 'MOD']
const STANDARD_MODIFIER_ORDER = ['MOD', 'CTRL', 'ALT', 'SHIFT']

export function shortcutPlatform(userAgent = navigator.userAgent): ShortcutPlatform {
  if (/Mac|iPhone|iPad|iPod/u.test(userAgent)) return 'mac'
  if (/Win/u.test(userAgent)) return 'windows'
  return 'linux'
}

function sortModifiers(modifiers: string[], platform: ShortcutPlatform): string[] {
  const order = platform === 'mac' ? MAC_MODIFIER_ORDER : STANDARD_MODIFIER_ORDER
  return [...modifiers].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

export function formatShortcut(
  shortcut: string | undefined,
  platform = shortcutPlatform()
): string | undefined {
  if (!shortcut) return undefined

  return shortcut
    .split(' ')
    .map((combo) => {
      const parts = compact(combo.split('+'))
      const modifiers = parts.filter((part) => part in MODIFIER_DISPLAY[platform])
      const keys = parts.filter((part) => !(part in MODIFIER_DISPLAY[platform]))
      const formattedModifiers = sortModifiers(modifiers, platform).map(
        (part) => MODIFIER_DISPLAY[platform][part]
      )
      const separator = platform === 'mac' ? '' : '+'
      return [...formattedModifiers, ...keys].join(separator)
    })
    .join(' ')
}
