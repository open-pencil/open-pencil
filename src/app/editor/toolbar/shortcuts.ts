import type { HotkeyPlatform } from '@tanstack/hotkeys'
import { mapValues } from 'es-toolkit/object'

import { TOOL_SHORTCUTS, type Tool } from '@open-pencil/core'
import { formatShortcut, isShortcut } from '@open-pencil/vue/editor/commands'

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
  COMMENT: '',
  EYEDROPPER: ''
}

/**
 * Each tool's key as the toolbar and Settings print it on this platform, from the key map the
 * editor profile offers: the first key that picks a tool names it.
 */
export function toolShortcutLabels(
  toolKeys: Readonly<Partial<Record<string, Tool>>> = TOOL_SHORTCUTS,
  platform?: HotkeyPlatform
): Readonly<Record<Tool, string>> {
  const keys = new Map<Tool, string>()
  for (const [shortcut, tool] of Object.entries(toolKeys)) {
    if (tool && !keys.has(tool)) keys.set(tool, shortcut)
  }
  return mapValues(UNKEYED, (_, tool) => {
    const key = keys.get(tool)
    return key && isShortcut(key) ? (formatShortcut(key, platform) ?? '') : ''
  })
}

/** A tool's tooltip: its name, then its key when it has one. */
export function toolTip(label: string, shortcut: string): string {
  return shortcut ? `${label} (${shortcut})` : label
}
