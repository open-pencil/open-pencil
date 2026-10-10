import type { Tool } from '@open-pencil/core/editor'

/** Each tool's key as the toolbar and Settings print it; empty for tools without one. */
export const TOOL_SHORTCUT_LABELS: Readonly<Record<Tool, string>> = {
  SELECT: 'V',
  FRAME: 'F',
  SECTION: 'S',
  RECTANGLE: 'R',
  ELLIPSE: 'O',
  LINE: 'L',
  POLYGON: '',
  STAR: '',
  PEN: 'P',
  TEXT: 'T',
  HAND: 'H',
  COMMENT: 'C'
}

/** A tool's tooltip: its name, then its key when it has one. */
export function toolTip(label: string, shortcut: string): string {
  return shortcut ? `${label} (${shortcut})` : label
}
