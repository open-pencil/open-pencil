import { mapValues } from 'es-toolkit/object'

import type { Tool } from '@open-pencil/core'
import { formatShortcut, type ShortcutPlatform } from '@open-pencil/vue/editor/commands'

/** Each tool's key in the command registry's notation; empty for tools without one. */
const TOOL_SHORTCUT_KEYS: Readonly<Record<Tool, string>> = {
  SELECT: 'V',
  FRAME: 'F',
  SECTION: 'SHIFT+S',
  RECTANGLE: 'R',
  ELLIPSE: 'O',
  LINE: 'L',
  POLYGON: '',
  STAR: '',
  PEN: 'P',
  PENCIL: 'SHIFT+P',
  TEXT: 'T',
  STICKY: '',
  SHAPE_WITH_TEXT: '',
  CONNECTOR: '',
  HAND: 'H',
  COMMENT: 'C'
}

/** Each tool's key as the toolbar and Settings print it on this platform. */
export function toolShortcutLabels(platform?: ShortcutPlatform): Readonly<Record<Tool, string>> {
  return mapValues(TOOL_SHORTCUT_KEYS, (keys) => formatShortcut(keys, platform) ?? '')
}

/** A tool's tooltip: its name, then its key when it has one. */
export function toolTip(label: string, shortcut: string): string {
  return shortcut ? `${label} (${shortcut})` : label
}
