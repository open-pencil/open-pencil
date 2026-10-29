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
  { key: 'PEN', label: 'Pen', shortcut: 'P', flyout: ['PEN', 'PENCIL'] },
  { key: 'TEXT', label: 'Text', shortcut: 'T' },
  // Figma's S is Slice, and FigJam's sticky tool has no key in Figma Design.
  { key: 'STICKY', label: 'Sticky note', shortcut: '' },
  // FigJam's R; here R is the rectangle, as in Figma Design.
  { key: 'SHAPE_WITH_TEXT', label: 'Shape', shortcut: '' },
  // FigJam's X; Figma Design has no connector tool to take a key from.
  { key: 'CONNECTOR', label: 'Connector', shortcut: '' },
  { key: 'HAND', label: 'Hand', shortcut: 'H' },
  { key: 'COMMENT', label: 'Comment', shortcut: 'C' }
]

export const TOOL_SHORTCUTS: Partial<Record<string, Tool>> = {
  KeyV: 'SELECT',
  KeyF: 'FRAME',
  KeyA: 'FRAME',
  'Shift+KeyS': 'SECTION',
  KeyR: 'RECTANGLE',
  KeyO: 'ELLIPSE',
  KeyL: 'LINE',
  KeyT: 'TEXT',
  KeyP: 'PEN',
  'Shift+KeyP': 'PENCIL',
  KeyH: 'HAND',
  KeyC: 'COMMENT'
}
