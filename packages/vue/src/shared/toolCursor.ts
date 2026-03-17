import type { Tool } from '@open-pencil/core/editor'

const TOOL_CURSORS: Record<Tool, string> = {
  SELECT: 'default',
  FRAME: 'crosshair',
  SECTION: 'crosshair',
  RECTANGLE: 'crosshair',
  ELLIPSE: 'crosshair',
  LINE: 'crosshair',
  POLYGON: 'crosshair',
  STAR: 'crosshair',
  TEXT: 'text',
  PEN: 'crosshair',
  HAND: 'grab',
}

export function toolCursor(tool: Tool, override?: string | null): string {
  if (override) return override
  return TOOL_CURSORS[tool] ?? 'default'
}
