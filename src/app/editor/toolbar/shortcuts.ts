import { mapValues } from 'es-toolkit/object'

import { TOOL_SHORTCUTS, type Tool } from '@open-pencil/core'
import { formatShortcut, type ShortcutPlatform } from '@open-pencil/vue/editor/commands'

/** A key code (`KeyR`, `Shift+KeyS`) in the command registry's notation (`R`, `SHIFT+S`). */
function registryKeys(code: string): string {
  return code
    .split('+')
    .map((part) => (part.startsWith('Key') ? part.slice(3) : part.toUpperCase()))
    .join('+')
}

/** Every tool, each without a key until the profile's key map gives it one. */
const UNKEYED: Readonly<Record<Tool, string>> = {
  SELECT: '',
  FRAME: '',
  SECTION: '',
  RECTANGLE: '',
  ELLIPSE: '',
  LINE: '',
  POLYGON: '',
  STAR: '',
  PEN: '',
  PENCIL: '',
  TEXT: '',
  STICKY: '',
  SHAPE_WITH_TEXT: '',
  CONNECTOR: '',
  HAND: '',
  COMMENT: ''
}

/**
 * Each tool's key as the toolbar and Settings print it on this platform, from the key map the
 * editor profile offers: the first key that picks a tool names it.
 */
export function toolShortcutLabels(
  toolKeys: Readonly<Partial<Record<string, Tool>>> = TOOL_SHORTCUTS,
  platform?: ShortcutPlatform
): Readonly<Record<Tool, string>> {
  const keys = new Map<Tool, string>()
  for (const [code, tool] of Object.entries(toolKeys)) {
    if (tool && !keys.has(tool)) keys.set(tool, registryKeys(code))
  }
  return mapValues(UNKEYED, (_, tool) => {
    const key = keys.get(tool)
    return key ? (formatShortcut(key, platform) ?? '') : ''
  })
}

/** A tool's tooltip: its name, then its key when it has one. */
export function toolTip(label: string, shortcut: string): string {
  return shortcut ? `${label} (${shortcut})` : label
}
