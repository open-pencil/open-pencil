import type { Tool } from './types'

export interface EditorToolDef {
  key: Tool
  label: string
  shortcut: string
  flyout?: Tool[]
}

export const EDITOR_TOOLS: EditorToolDef[] = [
  { key: 'SELECT', label: 'Move', shortcut: 'V' },
  { key: 'FRAME', label: 'Frame', shortcut: 'F', flyout: ['FRAME', 'SECTION'] },
  {
    key: 'RECTANGLE',
    label: 'Rectangle',
    shortcut: 'R',
    flyout: ['RECTANGLE', 'LINE', 'ELLIPSE', 'POLYGON', 'STAR']
  },
  { key: 'PEN', label: 'Pen', shortcut: 'P' },
  { key: 'TEXT', label: 'Text', shortcut: 'T' },
  { key: 'HAND', label: 'Hand', shortcut: 'H' }
]

export const TOOL_SHORTCUTS: Partial<Record<string, Tool>> = {
  KeyV: 'SELECT',
  KeyF: 'FRAME',
  KeyS: 'SECTION',
  KeyR: 'RECTANGLE',
  KeyO: 'ELLIPSE',
  KeyL: 'LINE',
  KeyT: 'TEXT',
  KeyP: 'PEN',
  KeyH: 'HAND'
}
